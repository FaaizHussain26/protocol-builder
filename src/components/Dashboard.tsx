import { useEffect, useState } from 'react';
import { Sparkles, Loader, AlertCircle, ArrowRight } from 'lucide-react';
import { listStudies, getStudy, isConfigured } from '../utils/api';
import type { StudyModel, StudySummary } from '../types/study';

interface DashboardProps {
  onNewBuild: () => void;
  onOpenStudy: (study: StudyModel, id: string) => void;
  onOpenLibrary: () => void;
  onOpenDrafts: () => void;
}

// Workspace home: totals across all saved data + recent eSources + quick actions.
export default function Dashboard({ onNewBuild, onOpenStudy, onOpenLibrary, onOpenDrafts }: DashboardProps) {
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    listStudies().then((s) => {
      if (!alive) return;
      setStudies(s);
      setLoading(false);
    }).catch((e) => {
      if (!alive) return;
      setError(e instanceof Error ? e.message : 'Failed to load workspace data');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const finals = studies.filter((s) => s.status === 'final');
  const drafts = studies.filter((s) => s.status !== 'final');
  const totalFields = studies.reduce((a, s) => a + s.fieldCount, 0);
  const totalVisits = studies.reduce((a, s) => a + s.visitCount, 0);
  const pendingFields = drafts.reduce((a, s) => a + Math.max(0, s.fieldCount - (s.approvedFieldCount ?? 0)), 0);
  const recent = studies.slice(0, 5); // list arrives sorted by updatedAt desc

  const openStudy = async (id: string) => {
    setBusyId(id);
    try {
      onOpenStudy(await getStudy(id), id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open study');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="anim-form" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
        paddingBottom: 26, borderBottom: '1px solid #E6E3DC', marginBottom: 26,
      }}>
        <div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A857B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Workspace</p>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', color: '#17181A' }}>Dashboard</h1>
        </div>
        <button className="lift" onClick={onNewBuild} style={{
          padding: '9px 16px', borderRadius: 9, border: 'none', background: '#17181A', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          New eSource
        </button>
      </div>

      {!isConfigured && (
        <Notice icon={<AlertCircle size={15} color="#973C38" />} bg="#FCEAEA" border="#F1CFCE" color="#973C38">
          Backend API is not configured (set <b>VITE_API_BASE_URL</b>) — workspace data is unavailable.
        </Notice>
      )}
      {error && (
        <Notice icon={<AlertCircle size={15} color="#A02D24" />} bg="#FBEDEB" border="#F1CFCE" color="#A02D24">
          {error}
        </Notice>
      )}

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div style={{ background: '#17100F', borderRadius: 14, padding: '20px 22px', color: '#fff' }}>
          <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#A6918E' }}>Needs review</p>
          <p style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 14 }}>
            {loading ? '—' : pendingFields.toLocaleString()}
          </p>
          <p style={{ fontSize: 12.5, color: '#A6918E', marginTop: 8 }}>fields across {drafts.length} draft{drafts.length !== 1 ? 's' : ''}</p>
        </div>
        <KpiTile dot="#2F6B4F" label="Saved eSources" value={finals.length} loading={loading} sub="fully approved" onClick={onOpenLibrary} />
        <KpiTile dot="#E0716D" label="Drafts in review" value={drafts.length} loading={loading} sub="in progress" onClick={onOpenDrafts} />
        <KpiTile dot="#8A857B" label="Fields across builds" value={totalFields} loading={loading} sub={`${totalVisits.toLocaleString()} visits scheduled`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Recent eSources */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 14px' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#17181A' }}>Recent eSources</p>
            {studies.length > 5 && (
              <button className="lift" onClick={onOpenLibrary} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none',
                background: 'none', color: '#8A857B', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              }}>
                View all <ArrowRight size={13} />
              </button>
            )}
          </div>
          {recent.length > 0 && !loading && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 90px 150px 100px', gap: 16,
              padding: '0 24px 8px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#A29C90', borderBottom: '1px solid #EFECE5', whiteSpace: 'nowrap',
            }}>
              <div>Study</div><div style={{ textAlign: 'right' }}>Fields</div><div>Approved</div><div style={{ textAlign: 'right' }}>Updated</div>
            </div>
          )}
          <div style={{ padding: recent.length > 0 && !loading ? '0 0 8px' : '10px 14px 14px' }}>
            {loading ? (
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#8A857B', fontSize: 13.5, padding: '20px 0', justifyContent: 'center' }}>
                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </p>
            ) : recent.length === 0 ? (
              <p style={{ color: '#A29C90', fontSize: 13.5, textAlign: 'center', padding: '20px 0' }}>
                No saved eSources yet — run your first build.
              </p>
            ) : recent.map((s) => {
              const approved = s.approvedFieldCount ?? 0;
              const pct = s.fieldCount ? Math.round((approved / s.fieldCount) * 100) : 0;
              const barColor = pct === 100 ? '#2F6B4F' : pct >= 50 ? '#E0716D' : '#A02D24';
              return (
                <button
                  key={s.id} disabled={busyId === s.id} onClick={() => openStudy(s.id)}
                  style={{
                    width: '100%', display: 'grid', gridTemplateColumns: 'minmax(200px,1fr) 90px 150px 100px',
                    gap: 16, alignItems: 'center', padding: '15px 24px', border: 'none', borderBottom: '1px solid #F4F1EA',
                    background: 'transparent', cursor: busyId === s.id ? 'wait' : 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#FBFAF7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#17181A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.studyTitle}
                    </span>
                    <span style={{ display: 'block', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#918B7F', marginTop: 3 }}>
                      {[s.protocolNumber, `${s.visitCount} visits`].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, textAlign: 'right', color: '#17181A' }}>{s.fieldCount.toLocaleString()}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, height: 5, borderRadius: 3, background: '#EDEAE2', overflow: 'hidden' }}>
                      <span style={{ display: 'block', height: '100%', borderRadius: 3, background: barColor, width: `${pct}%` }} />
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: '#6E6A62', width: 34, textAlign: 'right' }}>{pct}%</span>
                  </span>
                  <span style={{ fontSize: 12, color: '#918B7F', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionCard
            icon={<Sparkles size={17} color="#fff" />}
            iconBg="#BE4A46"
            title="New eSource"
            text="Upload a protocol + eCRF and let the AI build the structured eSource."
            onClick={onNewBuild}
          />
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: '1px solid #E6E3DC', overflow: 'hidden',
};

function Notice({ icon, bg, border, color, children }: {
  icon: React.ReactNode; bg: string; border: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 14px', borderRadius: 11,
      background: bg, border: `1px solid ${border}`, marginBottom: 16, fontSize: 13, color,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function KpiTile({ dot, label, value, sub, loading, onClick }: {
  dot: string; label: string; value: number; sub: string; loading: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? 'lift' : undefined}
      onClick={onClick}
      style={{ ...card, padding: '20px 22px', cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#8A857B' }}>{label}</span>
      </span>
      <p style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 14, color: '#17181A' }}>
        {loading ? '—' : value.toLocaleString()}
      </p>
      <p style={{ fontSize: 12.5, color: '#8A857B', marginTop: 8 }}>{sub}</p>
    </div>
  );
}

function ActionCard({ icon, iconBg, title, text, onClick }: {
  icon: React.ReactNode; iconBg: string; title: string; text: string; onClick: () => void;
}) {
  return (
    <button className="lift" onClick={onClick} style={{ ...card, padding: '16px 18px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span style={{
        width: 38, height: 38, borderRadius: 11, background: iconBg, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#17181A' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#8A857B', marginTop: 3, lineHeight: 1.5 }}>{text}</span>
      </span>
    </button>
  );
}
