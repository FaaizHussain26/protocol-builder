import jsPDF from 'jspdf';
import type { StudyModel } from '../types/study';

interface DocStats {
  total: number; accepted: number; rejected: number; flagged: number; pending: number; openBlockers: number;
}

const DISCLAIMER =
  'Conceptual reference only. The production build will be more refined, customized, and aligned with final workflow and specifications. Not certified or submission-ready.';

// ---------- shared helpers ----------
function setup(study: StudyModel, subtitle: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
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

  for (const visit of study.visits) {
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

  footers(doc, pageW, pageH, mL, mR, 'Completion Guidelines');
  doc.save(`${safeName(study.studyTitle)}_completion_guidelines.pdf`);
}

// ---------- 2. CTMS-ready Build Specification PDF ----------
export function generateBuildSpecPDF(study: StudyModel, stats: DocStats): void {
  const { doc, pageW, pageH, mL, mR, contentW } = setup(study, 'eSource Build Specification');
  let y = 42;
  const br = (need: number) => { if (y + need > pageH - 18) { doc.addPage(); y = 20; } };

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

  // Visit schedule + form summaries
  for (const visit of study.visits) {
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
      doc.text(`${form.name}${form.appliedTemplate ? `  (template: ${form.appliedTemplate})` : ''}`, mL + 4, y);
      y += 5;

      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      for (const f of fields) {
        br(6);
        const reqd = f.required ? ' *' : '';
        const line = `•  ${f.label}${reqd}  [${f.type}]  (${f.confidence})`;
        const ls = doc.splitTextToSize(line, contentW - 10);
        doc.text(ls, mL + 7, y);
        y += ls.length * 4.2;
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
