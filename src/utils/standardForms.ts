// Canonical clinical form taxonomy used for quick-insert and standard ordering.

export const SCREENING_FORM_NAMES = [
  'Date of Visit',
  'Informed Consent',
  'Demographics',
  'Inclusion/Exclusion Criteria',
  'Eligibility',
  'Vital Signs',
  'Physical Examination',
  'ECG',
  'Lab Assessments',
  'Progress Notes',
  'Completion',
];

export const GENERAL_FORM_NAMES = ['Medical History', 'Allergies', 'Social History', 'Adverse Events', 'Serious Adverse Events'];

export const ALL_STANDARD_NAMES = [...SCREENING_FORM_NAMES, ...GENERAL_FORM_NAMES];

// Rank a form name against the canonical Screening order (lower = earlier).
export function canonicalRank(name: string): number {
  const n = name.toLowerCase();
  const i = SCREENING_FORM_NAMES.findIndex((c) => {
    const head = c.toLowerCase().split('/')[0];
    return n.includes(head) || c.toLowerCase().includes(n);
  });
  return i === -1 ? 999 : i;
}
