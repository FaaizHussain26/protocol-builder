// Extract plain text from uploaded files (PDF, DOCX, TXT)
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Heuristic: does this document contain a Schedule of Activities table? Such a
// document is the real protocol and should be processed first so the model
// anchors its visit schedule on it (and so the SOA stays within the char cap).
const SOA_MARKER = /schedule of (activities|assessments|procedures|events)/i;

// Extract and combine text from multiple files with clear per-document headers.
// Documents that contain an SOA are placed first.
export async function extractTextFromFiles(files: File[]): Promise<string> {
  const docs = await Promise.all(
    Array.from(files).map(async file => {
      const text = (await extractTextFromFile(file)).trim();
      return { name: file.name, text, hasSOA: SOA_MARKER.test(text) };
    })
  );

  // Stable sort: SOA-bearing documents (the protocol) come before the rest.
  const ordered = docs
    .map((d, i) => ({ d, i }))
    .sort((a, b) => Number(b.d.hasSOA) - Number(a.d.hasSOA) || a.i - b.i)
    .map(x => x.d);

  const parts = ordered.map((d, i) => {
    const header = ordered.length > 1
      ? `===== DOCUMENT ${i + 1} of ${ordered.length}: ${d.name}${d.hasSOA ? ' (contains Schedule of Activities)' : ''} =====`
      : `===== DOCUMENT: ${d.name} =====`;
    return `${header}\n\n${d.text}`;
  });

  return parts.join('\n\n\n');
}

export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md') {
    return await file.text();
  }

  if (ext === 'pdf') {
    return await extractFromPDF(file);
  }

  if (ext === 'docx' || ext === 'doc') {
    return await extractFromDOCX(file);
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload PDF, DOCX, or TXT files.`);
}

interface PdfTextItem {
  str?: string;
  // transform is [scaleX, skewX, skewY, scaleY, x, y]; index 4 = x, 5 = y.
  transform?: number[];
}

// Reconstruct visual lines from positioned text items so that tables
// (especially the Schedule of Activities) keep their row structure instead of
// collapsing into one flat run of words. Items sharing a y-coordinate form a
// line; within a line they are ordered left-to-right by x.
function itemsToLines(items: PdfTextItem[]): string {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it.str || !it.transform) continue;
    // Round y to merge items that sit on the same visual line despite
    // sub-pixel differences.
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    const row = rows.get(y) ?? [];
    row.push({ x, s: it.str });
    rows.set(y, row);
  }
  const ys = [...rows.keys()].sort((a, b) => b - a); // top of page first
  return ys
    .map(y =>
      rows
        .get(y)!
        .sort((a, b) => a.x - b.x)
        .map(o => o.s)
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

async function extractFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = itemsToLines(content.items as PdfTextItem[]);
    // Page markers let the model cite accurate page numbers in traceability.
    pages.push(`[Page ${i}]\n${pageText}`);
  }

  return pages.join('\n\n');
}

async function extractFromDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
