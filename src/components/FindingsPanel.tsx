import { AlertTriangle, AlertOctagon, Info, CheckCircle2, RotateCcw } from 'lucide-react';
import type { IntelligenceFinding, FindingSeverity } from '../types/study';
import { ConfidenceBadge, Pill } from './ui';

const SEVERITY: Record<FindingSeverity, { bar: string; bg: string; fg: string; icon: React.ReactNode; label: string }> = {
  blocker: { bar: '#A02D24', bg: '#FBEDEB', fg: '#973C38', icon: <AlertOctagon size={16} color="#A02D24" />, label: 'Blocker' },
  warning: { bar: '#C9963D', bg: '#FBF6EC', fg: '#8A6D3F', icon: <AlertTriangle size={16} color="#C9963D" />, label: 'Warning' },
  info: { bar: '#BE4A46', bg: '#FDF1F1', fg: '#9C3733', icon: <Info size={16} color="#BE4A46" />, label: 'Info' },
};

export default function FindingsPanel({ findings, onResolve }: {
  findings: IntelligenceFinding[];
  onResolve: (id: string, resolved: boolean) => void;
}) {
  const open = findings.filter(f => !f.resolved);
  const openBlockers = open.filter(f => f.severity === 'blocker').length;

  if (findings.length === 0) {
    return <div style={{ padding: '60px 28px', textAlign: 'center', color: '#8A857B', fontSize: 14 }}>
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
        background: openBlockers > 0 ? '#FBEDEB' : '#EAF2ED',
        border: `1px solid ${openBlockers > 0 ? '#F1CFCE' : '#D3E4D9'}`,
      }}>
        {openBlockers > 0
          ? <AlertOctagon size={18} color="#A02D24" />
          : <CheckCircle2 size={18} color="#2F6B4F" />}
        <span style={{ fontSize: 13.5, fontWeight: 600, color: openBlockers > 0 ? '#973C38' : '#2F6B4F' }}>
          {openBlockers > 0
            ? `${openBlockers} blocking issue${openBlockers !== 1 ? 's' : ''} must be resolved before the build can be approved.`
            : 'No open blockers — build can proceed to approval.'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#6E6A62' }}>
          {open.length} open · {findings.length - open.length} resolved
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#8A857B', marginBottom: 16 }}>
        Cross-document issues surfaced by the AI.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map(f => {
          const s = SEVERITY[f.severity];
          return (
            <div key={f.id} style={{
              border: '1px solid #E6E3DC', borderRadius: 12, overflow: 'hidden',
              borderLeft: `3px solid ${f.resolved ? '#DCD8CF' : s.bar}`,
              opacity: f.resolved ? 0.62 : 1,
            }}>
              <div style={{ padding: '14px 16px', background: f.resolved ? '#FBFAF7' : s.bg }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#17181A' }}>{f.title}</h3>
                      <Pill bg="#fff" color={s.fg}>{s.label}</Pill>
                      <ConfidenceBadge level={f.confidence} compact />
                      {f.suggestedAction === 'block'
                        ? <Pill bg="#FBEDEB" color="#973C38">Action: block</Pill>
                        : <Pill bg="#FDF1F1" color="#BE4A46">Action: review</Pill>}
                    </div>
                    <p style={{ fontSize: 13, color: '#5C584F', marginTop: 6, lineHeight: 1.5 }}>{f.description}</p>
                    <p style={{ fontSize: 11.5, color: '#8A857B', marginTop: 6 }}>Source: {f.source}</p>
                  </div>
                  <button onClick={() => onResolve(f.id, !f.resolved)} style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${f.resolved ? '#E6E3DC' : '#DCD8CF'}`,
                    background: f.resolved ? '#fff' : '#17181A',
                    color: f.resolved ? '#6E6A62' : '#fff',
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
