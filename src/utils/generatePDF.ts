import jsPDF from 'jspdf';
import type { StudyModel } from '../types/study';

interface DocStats {
  total: number; accepted: number; rejected: number; flagged: number; pending: number; openBlockers: number;
}

const DISCLAIMER =
  'Conceptual reference only. The production build will be more refined, customized, and aligned with final workflow and specifications. Not certified or submission-ready.';

// ---------- shared helpers ----------
// jsPDF's built-in fonts only support WinAnsi (Latin-1). Characters outside it
// (↳ → ≥ ≤ “ ” … • and most symbols/emoji) render as mojibake such as "!³".
// Map the common ones to ASCII and drop anything else still unsupported.
function pdfSafe(s: string): string {
  const mapped = (s ?? '')
    .replace(/→/g, '->')
    .replace(/[↳↪⇒➔➜]/g, '>')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≠/g, '!=')
    .replace(/×/g, 'x')
    .replace(/[›»]/g, '>')
    .replace(/[‹«]/g, '<')
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, '...')
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-');
  // Drop anything still outside printable Latin-1 (keep tab/newline and high Latin-1).
  let out = '';
  for (const ch of mapped) {
    const c = ch.codePointAt(0) ?? 0;
    if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out += ch;
  }
  return out;
}

// Group visits by arm (folder) in canonical order for the export.
const PDF_ARM_ORDER = ['Study Visit', 'General', 'Unscheduled Visit', 'SAE', 'Early Termination', 'Reconsent'];
function armGroups(visits: StudyModel['visits']): { arm: string; visits: StudyModel['visits'] }[] {
  const map = new Map<string, StudyModel['visits']>();
  for (const v of visits) {
    const a = v.arm ?? 'Study Visit';
    if (!map.has(a)) map.set(a, []);
    map.get(a)!.push(v);
  }
  const rank = (x: string) => { const i = PDF_ARM_ORDER.indexOf(x); return i === -1 ? PDF_ARM_ORDER.length : i; };
  return [...map.keys()].sort((a, b) => rank(a) - rank(b)).map((arm) => ({ arm, visits: map.get(arm)! }));
}

function setup(study: StudyModel, subtitle: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Sanitize every string that reaches the page, in one place, so both authored
  // glyphs and AI-generated field text stay renderable.
  const origText = doc.text.bind(doc) as (text: string | string[], ...rest: unknown[]) => jsPDF;
  doc.text = ((text: string | string[], ...rest: unknown[]) =>
    origText(Array.isArray(text) ? text.map(pdfSafe) : pdfSafe(text), ...rest)) as typeof doc.text;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 18, mR = 18;
  const contentW = pageW - mL - mR;

  // header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 32, 'F');
  doc.setTextColor(242, 106, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(subtitle.toUpperCase(), mL, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  const titleLines = doc.splitTextToSize(study.studyTitle, contentW);
  doc.text(titleLines.slice(0, 2), mL, 20);

  return { doc, pageW, pageH, mL, mR, contentW };
}

function footers(doc: jsPDF, pageW: number, pageH: number, mL: number, mR: number, label: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(mL, pageH - 14, pageW - mR, pageH - 14);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const dis = doc.splitTextToSize(DISCLAIMER, pageW - mL - mR - 24);
    doc.text(dis, mL, pageH - 10);
    doc.text(`${label} · Page ${i} of ${n}`, pageW - mR, pageH - 10, { align: 'right' });
  }
}

function safeName(s: string) {
  return s.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 60);
}

// ---------- 1. Completion Guidelines PDF ----------
export function generateCompletionGuidelinesPDF(study: StudyModel): void {
  const { doc, pageW, pageH, mL, mR, contentW } = setup(study, 'Completion Guidelines');
  let y = 42;
  const br = (need: number) => { if (y + need > pageH - 18) { doc.addPage(); y = 20; } };

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, mL, y);
  y += 10;

  for (const grp of armGroups(study.visits)) {
    br(14);
    doc.setFillColor(124, 58, 237);
    doc.rect(mL, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`ARM: ${grp.arm}`, mL + 3, y + 5.5);
    y += 12;
    for (const visit of grp.visits) {
    for (const form of visit.forms) {
      const fields = form.fields.filter(f => f.reviewStatus !== 'rejected' && f.completionGuidance);
      if (fields.length === 0) continue;
      br(18);
      doc.setFillColor(241, 245, 249);
      doc.rect(mL, y, contentW, 9, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`${visit.name}  ›  ${form.name}`, mL + 3, y + 6);
      y += 13;

      if (form.repeatable) {
        br(6);
        doc.setTextColor(99, 102, 241);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('Repeatable form - complete these fields for each record.', mL + 3, y);
        y += 6;
      }

      for (const f of fields) {
        br(16);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        const lab = doc.splitTextToSize(`${f.label}${f.required ? ' *' : ''}`, contentW - 6);
        doc.text(lab, mL + 3, y);
        y += lab.length * 4.6 + 1;

        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const g = doc.splitTextToSize(f.completionGuidance ?? '', contentW - 6);
        doc.text(g, mL + 3, y);
        y += g.length * 4.4 + 5;
      }
      y += 3;
    }
    }
  }

  footers(doc, pageW, pageH, mL, mR, 'Completion Guidelines');
  doc.save(`${safeName(study.studyTitle)}_completion_guidelines.pdf`);
}

// Draws a single field as a CRF-style data-entry control. Returns the new y.
function drawField(doc: jsPDF, f: import('../types/study').StudyField, x: number, y: number, w: number): number {
  // Label + required asterisk
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const labelLines = doc.splitTextToSize(`${f.label}${f.required ? ' *' : ''}`, w);
  doc.text(labelLines, x, y);
  let cy = y + labelLines.length * 4.0 + 1.5;

  doc.setDrawColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);

  const box = (bw: number, bh: number, placeholder?: string) => {
    doc.rect(x, cy, bw, bh);
    if (placeholder) doc.text(placeholder, x + 2, cy + bh / 2 + 1.3);
    cy += bh;
  };

  // Treat a "dropdown" like a single-choice select so its options are printed.
  const ftype = (f.type as string) === 'dropdown' ? 'select' : f.type;
  switch (ftype) {
    case 'textarea': box(w, 14); break;
    case 'text': box(w, 6.5); break;
    case 'number': case 'integer': case 'decimal': box(42, 6.5, '0'); break;
    case 'date': box(46, 6.5, 'DD-MMM-YYYY'); break;
    case 'datetime': box(62, 6.5, 'DD-MMM-YYYY  HH:MM'); break;
    case 'time': box(28, 6.5, 'HH:MM'); break;
    // Single-choice (dropdown/select/radio/yes-no) print as radio options — ONE
    // PER LINE so every option is visible; multi-choice print as checkboxes.
    case 'select': case 'radio': case 'yesno': case 'multiselect': case 'checkbox': {
      // Dropdown/select fields always offer an N/A choice (matches the app preview).
      const opts = ftype === 'yesno'
        ? ['Yes', 'No']
        : ftype === 'select'
          ? [...(f.options ?? []), 'N/A']
          : (f.options?.length ? f.options : ['(no options specified)']);
      const isMulti = ftype === 'multiselect' || ftype === 'checkbox';
      doc.setTextColor(71, 85, 105);
      for (const opt of opts) {
        const ol = doc.splitTextToSize(opt, w - 8);
        if (isMulti) doc.rect(x, cy + 0.4, 3.2, 3.2);
        else doc.circle(x + 1.6, cy + 2, 1.6);
        doc.text(ol, x + 6, cy + 3);
        cy += Math.max(5.6, ol.length * 4.4);
      }
      doc.setTextColor(148, 163, 184);
      break;
    }
    case 'signature': {
      doc.rect(x, cy, 72, 12);
      doc.text('Signature', x + 2, cy + 10);
      cy += 12;
      break;
    }
    case 'file': {
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(x, cy, 60, 8);
      doc.setLineDashPattern([], 0);
      doc.text('Attach file', x + 2, cy + 5);
      cy += 8;
      break;
    }
    case 'calculated': {
      doc.setFillColor(243, 244, 246);
      doc.rect(x, cy, w, 6.5, 'F');
      doc.setTextColor(124, 58, 237);
      doc.text(`= ${f.expression || 'calculated'}`, x + 2, cy + 4.3);
      cy += 6.5;
      break;
    }
    default: box(w, 6.5);
  }

  return cy + 4;
}

// Draws a repeatable form as a table: one column per field, a header row of
// labels, and three blank rows to signal the site adds one row per record.
// Returns the new y.
function drawRepeatableTable(
  doc: jsPDF, fields: import('../types/study').StudyField[], x: number, y: number, w: number,
  br: (need: number) => number,
): number {
  const n = fields.length;
  if (!n) return y;
  const colW = w / n;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const headerLines = fields.map(f => doc.splitTextToSize(`${f.label}${f.required ? ' *' : ''}`, colW - 2));
  const headerH = Math.max(6, Math.max(...headerLines.map(l => l.length)) * 3.1 + 3);
  const rowH = 7;
  y = br(headerH + rowH * 3 + 4);

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(238, 242, 255);
  doc.rect(x, y, w, headerH, 'F');
  doc.setTextColor(55, 48, 163);
  let cx = x;
  for (let i = 0; i < n; i++) {
    doc.rect(cx, y, colW, headerH);
    doc.text(headerLines[i], cx + 1.2, y + 3.4);
    cx += colW;
  }
  let cy = y + headerH;
  doc.setTextColor(148, 163, 184);
  for (let r = 0; r < 3; r++) {
    cx = x;
    for (let i = 0; i < n; i++) { doc.rect(cx, cy, colW, rowH); cx += colW; }
    cy += rowH;
  }
  return cy + 2;
}

// ---------- 2. CTMS-ready Build Specification PDF ----------
export function generateBuildSpecPDF(study: StudyModel, stats: DocStats): void {
  const { doc, pageW, pageH, mL, mR, contentW } = setup(study, 'eSource Build Specification');
  let y = 42;
  const br = (need: number) => { if (y + need > pageH - 18) { doc.addPage(); y = 20; } return y; };

  // Study details
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const meta = [
    study.protocolNumber && `Protocol: ${study.protocolNumber}`,
    study.phase && `Phase: ${study.phase}`,
    study.indication && `Indication: ${study.indication}`,
    study.sponsor && `Sponsor: ${study.sponsor}`,
  ].filter(Boolean).join('   |   ');
  if (meta) { doc.text(meta, mL, y); y += 6; }
  const desc = doc.splitTextToSize(study.studyDescription, contentW);
  doc.text(desc, mL, y); y += desc.length * 4.6 + 4;

  // Review trail summary
  br(20);
  doc.setFillColor(15, 23, 42);
  doc.rect(mL, y, contentW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('REVIEW TRAIL', mL + 3, y + 5.5);
  y += 12;
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Fields: ${stats.total}    Approved: ${stats.accepted}    Rejected: ${stats.rejected}    Pending: ${stats.pending}    Open blockers: ${stats.openBlockers}`, mL + 3, y);
  y += 5;
  doc.text(`Source documents: ${study.documents.map(d => d.name).join(', ') || '—'}`, mL + 3, y);
  y += 9;

  // Arm → Visit schedule + form summaries
  for (const grp of armGroups(study.visits)) {
    br(12);
    doc.setFillColor(124, 58, 237);
    doc.rect(mL, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`ARM: ${grp.arm}`, mL + 3, y + 5.5);
    y += 12;
    for (const visit of grp.visits) {
    br(16);
    doc.setFillColor(241, 245, 249);
    doc.rect(mL, y, contentW, 9, 'F');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const vh = `${visit.kind === 'log' ? '[LOG] ' : ''}${visit.name}` +
      (visit.timing ? `   ·   ${visit.timing}` : '') + (visit.window ? `   ·   window ${visit.window}` : '');
    doc.text(vh, mL + 3, y + 6);
    y += 13;

    for (const form of visit.forms) {
      const fields = form.fields.filter(f => f.reviewStatus !== 'rejected');
      br(12);
      doc.setTextColor(37, 99, 235);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`${form.name}${form.repeatable ? '  [repeatable]' : ''}${form.appliedTemplate ? `  (template: ${form.appliedTemplate})` : ''}`, mL + 4, y);
      y += 5;

      if (form.repeatable) {
        doc.setTextColor(99, 102, 241);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        br(6);
        doc.text('Repeatable - the site adds one row per record (Row 1 shown):', mL + 7, y);
        y += 4;
        y = drawRepeatableTable(doc, fields, mL + 7, y, contentW - 12, br);
      } else {
        for (const f of fields) {
          const ft = (f.type as string) === 'dropdown' ? 'select' : f.type;
          const isChoice = ft === 'select' || ft === 'radio' || ft === 'yesno' || ft === 'multiselect' || ft === 'checkbox';
          // select adds an N/A row (see drawField); yes/no is fixed at 2.
          const optCount = ft === 'yesno' ? 2 : ft === 'select' ? (f.options?.length ?? 0) + 1 : (f.options?.length || 1);
          const ctrlH = ft === 'textarea' ? 16
            : ft === 'signature' ? 14
            : ft === 'file' ? 12
            : isChoice ? optCount * 5.8 + 2
            : 10;
          br(14 + ctrlH);
          y = drawField(doc, f, mL + 7, y, contentW - 12);
        }
      }
      // accepted rules
      const rules = form.rules.filter(r => r.accepted === true);
      for (const r of rules) {
        br(6);
        doc.setTextColor(124, 58, 237);
        const rs = doc.splitTextToSize(`   ↳ edit check (${r.ruleType}): ${r.description}`, contentW - 10);
        doc.text(rs, mL + 7, y);
        y += rs.length * 4.2;
        doc.setTextColor(71, 85, 105);
      }
      y += 3;
    }
    y += 3;
  }
  }

  // Eligibility appendix
  if (study.eligibility.length) {
    br(16);
    doc.setFillColor(15, 23, 42);
    doc.rect(mL, y, contentW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ELIGIBILITY LOGIC', mL + 3, y + 5.5);
    y += 12;
    doc.setFontSize(8.5);
    for (const e of study.eligibility) {
      br(8);
      doc.setTextColor(e.kind === 'inclusion' ? 22 : 220, e.kind === 'inclusion' ? 163 : 38, e.kind === 'inclusion' ? 74 : 38);
      doc.setFont('helvetica', 'bold');
      doc.text(e.kind === 'inclusion' ? 'INCL' : 'EXCL', mL + 3, y);
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      const es = doc.splitTextToSize(`${e.criterion}  →  ${e.logic}`, contentW - 16);
      doc.text(es, mL + 16, y);
      y += es.length * 4.2 + 2;
    }
  }

  footers(doc, pageW, pageH, mL, mR, 'Build Specification');
  doc.save(`${safeName(study.studyTitle)}_build_spec.pdf`);
}

// ---------- 3. Structured JSON export ----------
export function downloadStudyJSON(study: StudyModel): void {
  const payload = {
    exportType: 'eSource-build-specification',
    generatedAt: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    study,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName(study.studyTitle)}_build_spec.json`;
  a.click();
  URL.revokeObjectURL(url);
}
