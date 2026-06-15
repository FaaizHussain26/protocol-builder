import { CheckCircle2, XCircle } from 'lucide-react';
import type { EligibilityCriterion } from '../types/study';
import { ConfidenceBadge } from './ui';

export default function EligibilityPanel({ eligibility }: { eligibility: EligibilityCriterion[] }) {
  const inclusion = eligibility.filter(e => e.kind === 'inclusion');
  const exclusion = eligibility.filter(e => e.kind === 'exclusion');

  if (eligibility.length === 0) {
    return <Empty text="No eligibility criteria were extracted from the source documents." />;
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <p style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>
        Inclusion and exclusion criteria converted into pass/fail checklist logic. Each item shows the
        original criterion, the suggested logic, and the AI's confidence.
      </p>

      <CriteriaGroup
        title="Inclusion Criteria"
        accent="#16a34a"
        icon={<CheckCircle2 size={16} color="#16a34a" />}
        items={inclusion}
      />
      <div style={{ height: 24 }} />
      <CriteriaGroup
        title="Exclusion Criteria"
        accent="#dc2626"
        icon={<XCircle size={16} color="#dc2626" />}
        items={exclusion}
      />
    </div>
  );
}

function CriteriaGroup({ title, accent, icon, items }: {
  title: string; accent: string; icon: React.ReactNode; items: EligibilityCriterion[];
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {icon}
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>({items.length})</span>
      </div>

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', paddingLeft: 24 }}>None identified.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((e, i) => (
            <div key={e.id} style={{
              border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px',
              borderLeft: `3px solid ${accent}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: '#f1f5f9', color: '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13.5, color: '#1e293b', fontWeight: 600, lineHeight: 1.45 }}>{e.criterion}</p>
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    background: '#f8fafc', border: '1px solid #f1f5f9',
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4 }}>Pass / Fail logic</span>
                    <span style={{ fontSize: 13, color: '#475569', flex: 1 }}>{e.logic}</span>
                    <ConfidenceBadge level={e.confidence} compact />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '60px 28px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>{text}</div>
  );
}
