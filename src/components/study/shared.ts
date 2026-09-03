// Shared helpers, consts, and styles extracted from StudyBuilder.
import type { ReviewStatus, StudyField, StudyForm } from '../../types/study';

export const visitCtlBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid #E6E3DC',
  background: '#fff', color: '#6E6A62', cursor: 'pointer', flexShrink: 0,
};

export const reorderBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 20, height: 16, borderRadius: 5, border: '1px solid #E6E3DC',
  background: '#fff', color: disabled ? '#DCD8CF' : '#6E6A62',
  cursor: disabled ? 'default' : 'pointer', padding: 0, flexShrink: 0,
});

// RAG palette shared by field cards, form list dots, and filter chips.
export const RAG: Record<ReviewStatus, string> = { accepted: '#2F6B4F', pending: '#C9963D', rejected: '#A02D24' };

// A form's aggregate review status: red if anything is rejected, green when
// every field is approved, amber while anything is still pending.
export function formReviewStatus(f: StudyForm): ReviewStatus {
  if (!f.fields.length) return 'pending';
  if (f.fields.some(x => x.reviewStatus === 'rejected')) return 'rejected';
  if (f.fields.every(x => x.reviewStatus === 'accepted')) return 'accepted';
  return 'pending';
}

// Group a form's fields into ordered sections (preserving first-seen order) so
// the questionnaire renders as titled subsections. Fields with no section fall
// into a single leading unlabeled group.
export function groupFieldsBySection(fields: StudyField[]): { key: string; section: string | null; fields: StudyField[] }[] {
  const order: (string | null)[] = [];
  const bySection = new Map<string | null, StudyField[]>();
  for (const f of fields) {
    const key = f.section?.trim() || null;
    if (!bySection.has(key)) { bySection.set(key, []); order.push(key); }
    bySection.get(key)!.push(f);
  }
  return order.map((section, i) => ({
    key: section ?? `__nosection_${i}`,
    section,
    fields: bySection.get(section)!,
  }));
}

