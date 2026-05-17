import jsPDF from 'jspdf';
import type { GeneratedForm, FormAnswers } from '../types/form';

export function generateFormPDF(form: GeneratedForm, answers: FormAnswers = {}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;
  let y = 20;

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageH - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Header background
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(form.formTitle, contentW);
  doc.text(titleLines, marginL, 16);

  // Description
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(form.formDescription, contentW);
  doc.text(descLines, marginL, 26 + (titleLines.length - 1) * 7);

  y = 48;

  // Date generated
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, marginL, y);
  y += 8;

  let questionNumber = 1;

  for (const section of form.sections) {
    checkPageBreak(16);

    // Section header
    doc.setFillColor(241, 245, 249);
    doc.rect(marginL, y, contentW, 9, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(marginL, y, contentW, 9, 'S');
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(section.sectionTitle.toUpperCase(), marginL + 4, y + 6);
    y += 14;

    for (const q of section.questions) {
      const answer = answers[q.id];
      const answerText = Array.isArray(answer) ? answer.join(', ') : (answer || '');

      checkPageBreak(28);

      // Question number badge
      doc.setFillColor(37, 99, 235);
      doc.circle(marginL + 4, y + 3, 3.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(String(questionNumber), marginL + 4, y + 4.5, { align: 'center' });

      // Question text
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const qLines = doc.splitTextToSize(
        q.question + (q.required ? ' *' : ''),
        contentW - 14
      );
      doc.text(qLines, marginL + 11, y + 3);
      y += qLines.length * 5 + 2;

      // Help text
      if (q.helpText) {
        checkPageBreak(6);
        doc.setTextColor(100, 116, 139);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        const helpLines = doc.splitTextToSize(q.helpText, contentW - 14);
        doc.text(helpLines, marginL + 11, y);
        y += helpLines.length * 4 + 2;
      }

      // Answer area
      checkPageBreak(12);
      if (q.type === 'yesno' || q.type === 'radio') {
        const opts = q.type === 'yesno' ? ['Yes', 'No'] : (q.options ?? []);
        let optX = marginL + 11;
        for (const opt of opts) {
          const selected = answerText === opt;
          doc.setDrawColor(148, 163, 184);
          doc.circle(optX + 2.5, y + 2.5, 2.5, selected ? 'FD' : 'S');
          if (selected) {
            doc.setFillColor(37, 99, 235);
            doc.circle(optX + 2.5, y + 2.5, 1.2, 'F');
          }
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text(opt, optX + 7, y + 3.5);
          optX += doc.getTextWidth(opt) + 14;
          if (optX > pageW - marginR - 20) { optX = marginL + 11; y += 7; }
        }
        y += 8;
      } else if (q.type === 'checkbox') {
        const opts = q.options ?? [];
        const selected = Array.isArray(answer) ? answer : [];
        for (const opt of opts) {
          checkPageBreak(7);
          const checked = selected.includes(opt);
          doc.setDrawColor(148, 163, 184);
          doc.setFillColor(checked ? 37 : 255, checked ? 99 : 255, checked ? 235 : 255);
          doc.rect(marginL + 11, y, 4, 4, 'FD');
          if (checked) {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7);
            doc.text('✓', marginL + 12, y + 3.2);
          }
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text(opt, marginL + 18, y + 3.2);
          y += 6;
        }
        y += 2;
      } else if (q.type === 'select') {
        checkPageBreak(10);
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(marginL + 11, y, contentW - 14, 8, 'FD');
        doc.setTextColor(answerText ? 30 : 148, answerText ? 41 : 163, answerText ? 59 : 184);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(answerText || (q.placeholder ?? 'Select an option...'), marginL + 14, y + 5.5);
        y += 12;
      } else {
        // text / textarea / number / date
        const boxH = q.type === 'textarea' ? 18 : 8;
        checkPageBreak(boxH + 4);
        doc.setDrawColor(203, 213, 225);
        doc.setFillColor(248, 250, 252);
        doc.rect(marginL + 11, y, contentW - 14, boxH, 'FD');
        if (answerText) {
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          const aLines = doc.splitTextToSize(answerText, contentW - 20);
          doc.text(aLines.slice(0, q.type === 'textarea' ? 4 : 1), marginL + 14, y + 5.5);
        } else if (q.placeholder) {
          doc.setTextColor(148, 163, 184);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.text(q.placeholder, marginL + 14, y + 5.5);
        }
        y += boxH + 4;
      }

      y += 4;
      questionNumber++;
    }

    y += 4;
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(form.formTitle, marginL, pageH - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageW - marginR, pageH - 7, { align: 'right' });
  }

  const safeName = form.formTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeName}.pdf`);
}
