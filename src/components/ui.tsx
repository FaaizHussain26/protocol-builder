import type { Confidence } from '../types/study';

const CONFIDENCE_STYLES: Record<Confidence, { bg: string; fg: string; label: string }> = {
  high: { bg: '#dcfce7', fg: '#15803d', label: 'High confidence' },
  medium: { bg: '#fef9c3', fg: '#854d0e', label: 'Medium confidence' },
  low: { bg: '#fee2e2', fg: '#b91c1c', label: 'Low — review' },
};

export function ConfidenceBadge({ level, compact }: { level: Confidence; compact?: boolean }) {
  const s = CONFIDENCE_STYLES[level];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: compact ? '2px 8px' : '3px 10px', borderRadius: 20,
      background: s.bg, color: s.fg,
      fontSize: compact ? 11 : 12, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.fg }} />
      {compact ? level : s.label}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  text: 'Text', textarea: 'Long text', number: 'Number', date: 'Date',
  time: 'Time', select: 'Dropdown', radio: 'Single choice',
  checkbox: 'Multi choice', yesno: 'Yes / No',
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 6,
      background: '#eff6ff', color: '#2563eb',
      fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
    }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export function Pill({ children, color = '#475569', bg = '#f1f5f9' }: {
  children: React.ReactNode; color?: string; bg?: string;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20, background: bg, color,
      fontSize: 11, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}
