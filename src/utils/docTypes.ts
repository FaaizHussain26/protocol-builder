// Supported source document roles for multi-document ingestion.
export const DOC_TYPES = [
  'Protocol',
  'Schedule of Assessments',
  'Lab Manual',
  'Imaging Manual',
  'Eligibility Worksheet',
  'Sponsor Reference',
  'Other',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

// Best-effort detection of a document's role from its filename.
export function detectDocType(filename: string): DocType {
  const n = filename.toLowerCase();
  if (/(protocol|prot[_-]?v|study\s*protocol)/.test(n)) return 'Protocol';
  if (/(schedule|assessment|soa|visit)/.test(n)) return 'Schedule of Assessments';
  if (/(lab|laborator)/.test(n)) return 'Lab Manual';
  if (/(imaging|radiolog|mri|ct\b|scan)/.test(n)) return 'Imaging Manual';
  if (/(eligib|inclusion|exclusion|screen)/.test(n)) return 'Eligibility Worksheet';
  if (/(sponsor|reference|guidance)/.test(n)) return 'Sponsor Reference';
  return 'Protocol';
}

export function fileKey(f: File): string {
  return `${f.name}::${f.size}`;
}
