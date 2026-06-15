import { AlertTriangle, AlertOctagon, Info, CheckCircle2, RotateCcw } from 'lucide-react';
import type { IntelligenceFinding, FindingSeverity } from '../types/study';
import { ConfidenceBadge, Pill } from './ui';

const SEVERITY: Record<FindingSeverity, { bar: string; bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  blocker: { bar: '#dc2626', bg: '#fef2f2', fg: '#b91c1c', icon: <AlertOctagon size={16} color="#dc2626" />, label: 'Blocker' },
  warning: { bar: '#f59e0b', bg: '#fffbeb', fg: '#b45309', icon: <AlertTriangle size={16} color="#f59e0b" />, label: 'Warning' },
  info: { bar: '#3b82f6', bg: '#eff6ff', fg: '#1d4ed8', icon: <Info size={16} color="#3b82f6" />, label: 'Info' },
};

export default function FindingsPanel({ findings, onResolve }: {
  findings: IntelligenceFinding[];
  onResolve: (id: string, resolved: boolean) => void;
}) {
  const open = findings.filter(f => !f.resolved);
  const openBlockers = open.filter(f => f.severity === 'blocker').length;

  if (findings.length === 0) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      No intelligence findings were surfaced.
    </div>;
  }

  // Sort: blockers first, then warning, then info; resolved sink to bottom.
  const order: FindingSeverity[] = ['blocker', 'warning', 'info'];
  const sorted = [...findings].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18,
        padding: '12px 16px', borderRadius: 12,
        background: openBlockers > 0 ? '#fef2f2' : '#f0fdf4',
        border: `1px solid ${openBlockers > 0 ? '#fecaca' : '#bbf7d0'}`,
      }}>
        {openBlockers > 0
          ? <AlertOctagon size={18} color="#dc2626" />
          : <CheckCircle2 size={18} color="#16a34a" />}
        <span style={{ fontSize: 13.5, fontWeight: 600, color: openBlockers > 0 ? '#b91c1c' : '#15803d' }}>
          {openBlockers > 0
            ? `${openBlockers} blocking issue${openBlockers !== 1 ? 's' : ''} must be resolved before the build can be approved.`
            : 'No open blockers — build can proceed to approval.'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#64748b' }}>
          {open.length} open · {findings.length - open.length} resolved
        </span>
      </div>

      <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
        Protocol-aware findings surfaced across the source documents. Each shows what it is, where it came
        from, a confidence level, and a suggested action.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map(f => {
          const s = SEVERITY[f.severity];
          return (
            <div key={f.id} style={{
              border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
              borderLeft: `3px solid ${f.resolved ? '#cbd5e1' : s.bar}`,
              opacity: f.resolved ? 0.62 : 1,
            }}>
              <div style={{ padding: '14px 16px', background: f.resolved ? '#f8fafc' : s.bg }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#1e293b' }}>{f.title}</h3>
                      <Pill bg="#fff" color={s.fg}>{s.label}</Pill>
                      <ConfidenceBadge level={f.confidence} compact />
                      {f.suggestedAction === 'block'
                        ? <Pill bg="#fee2e2" color="#b91c1c">Action: block</Pill>
                        : <Pill bg="#eff6ff" color="#2563eb">Action: review</Pill>}
                    </div>
                    <p style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.5 }}>{f.description}</p>
                    <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>Source: {f.source}</p>
                  </div>
                  <button onClick={() => onResolve(f.id, !f.resolved)} style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${f.resolved ? '#e2e8f0' : '#cbd5e1'}`,
                    background: f.resolved ? '#fff' : '#1e293b',
                    color: f.resolved ? '#64748b' : '#fff',
                    fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {f.resolved ? <><RotateCcw size={12} /> Reopen</> : <><CheckCircle2 size={12} /> Resolve</>}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
