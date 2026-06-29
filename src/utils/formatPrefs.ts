import type { TemplatePreferences, DateSegment } from '../types/study';

const TOKEN: Record<DateSegment, string> = { D: 'DD', M: 'MMM', Y: 'YYYY' };

// Example values for a sample date (9 April 2026) — chosen so single vs padded
// tokens differ visibly (D=9 vs DD=09, M=4 vs MM=04).
const SAMPLE_TOKENS: Record<string, string> = {
  YYYY: '2026', YY: '26',
  MMMM: 'April', MMM: 'Apr', MM: '04', M: '4',
  DD: '09', D: '9',
};

// Legacy: build a token format string from the segment model.
export function dateFormatString(p: Pick<TemplatePreferences, 'dateOrder' | 'dateSeparator'>): string {
  return (p.dateOrder ?? ['M', 'Y', 'D']).map((s) => TOKEN[s] ?? '').filter(Boolean).join(p.dateSeparator || ' ');
}

// Render a sample from a token format string, e.g. "YYYY-MM-DD" → "2026-04-09",
// "YY" → "26", "MMM YYYY" → "Apr 2026". Non-token text is kept literally.
export function renderDateSample(format: string): string {
  if (!format) return '';
  return format.replace(/YYYY|YY|MMMM|MMM|MM|DD|M|D/g, (t) => SAMPLE_TOKENS[t] ?? t);
}

// Resolve a template's effective date format (token string preferred).
export function resolveDateFormat(p: Pick<TemplatePreferences, 'dateFormat' | 'dateOrder' | 'dateSeparator'>): string {
  return p.dateFormat?.trim() || dateFormatString(p);
}

// Human-readable example for a template (used in summaries).
export function sampleDate(p: Pick<TemplatePreferences, 'dateFormat' | 'dateOrder' | 'dateSeparator'>): string {
  return renderDateSample(resolveDateFormat(p));
}
