// Extract plain text from uploaded files (PDF, DOCX, TXT)
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

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

async function extractFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        const textItem = item as { str?: string };
        return textItem.str ?? '';
      })
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

async function extractFromDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
