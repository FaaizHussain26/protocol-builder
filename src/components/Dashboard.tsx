import { useEffect, useState } from 'react';
import {
  Layers, FolderOpen, SlidersHorizontal, Sparkles, FileText,
  Loader, AlertCircle, ArrowRight, ClipboardList, CalendarDays, PenLine,
} from 'lucide-react';
import { listStudies, listTemplates, getStudy, isConfigured } from '../utils/api';
import type { StudyModel, StudySummary, Template } from '../types/study';

interface DashboardProps {
  onNewBuild: () => void;
  onOpenStudy: (study: StudyModel, id: string) => void;
  onOpenLibrary: () => void;
  onOpenDrafts: () => void;
  onOpenTemplates: () => void;
}

// Workspace home: totals across all saved data + recent eSources + quick actions.
export default function Dashboard({ onNewBuild, onOpenStudy, onOpenLibrary, onOpenDrafts, onOpenTemplates }: DashboardProps) {
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) return;
    let alive = true;
    Promise.allSettled([listStudies(), listTemplates()]).then(([s, t]) => {
      if (!alive) return;
      if (s.status === 'fulfilled') setStudies(s.value);
      if (t.status === 'fulfilled') setTemplates(t.value);
      if (s.status === 'rejected') setError(s.reason instanceof Error ? s.reason.message : 'Failed to load workspace data');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const finals = studies.filter((s) => s.status === 'final');
  const drafts = studies.filter((s) => s.status !== 'final');
  const totalFields = studies.reduce((a, s) => a + s.fieldCount, 0);
  const totalVisits = studies.reduce((a, s) => a + s.visitCount, 0);
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
    <div className="anim-form" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0b1220', letterSpacing: -0.6 }}>Dashboard</h1>
        <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 4 }}>
          Everything in your eSource workspace — builds, templates, and review activity.
        </p>
      </div>

      {!isConfigured && (
        <Notice icon={<AlertCircle size={15} color="#b45309" />} bg="#fffbeb" border="#fde68a" color="#92400e">
          Backend API is not configured (set <b>VITE_API_BASE_URL</b>) — workspace data is unavailable.
        </Notice>
      )}
      {error && (
        <Notice icon={<AlertCircle size={15} color="#ef4444" />} bg="#fef2f2" border="#fecaca" color="#dc2626">
          {error}
        </Notice>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <StatCard icon={<FolderOpen size={17} />} tint="#16a34a" label="Saved E-Sources" value={finals.length} loading={loading} onClick={onOpenLibrary} />
        <StatCard icon={<PenLine size={17} />} tint="#f59e0b" label="Drafts in review" value={drafts.length} loading={loading} onClick={onOpenDrafts} />
        <StatCard icon={<ClipboardList size={17} />} tint="#7c3aed" label="Fields across builds" value={totalFields} loading={loading} />
        <StatCard icon={<CalendarDays size={17} />} tint="#f26a1b" label="Visits scheduled" value={totalVisits} loading={loading} />
        <StatCard icon={<SlidersHorizontal size={17} />} tint="#0d9488" label="Preference templates" value={templates.length} loading={loading} onClick={onOpenTemplates} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* Recent eSources */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 18px', borderBottom: '1px solid #eef2f7' }}>
            <FolderOpen size={15} color="#2563eb" />
            <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Recent E-Sources</h2>
            {studies.length > 5 && (
              <button className="lift" onClick={onOpenLibrary} style={{
                marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none',
                background: 'none', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>
                View all <ArrowRight size={13} />
              </button>
            )}
          </div>
          <div style={{ padding: '10px 14px 14px' }}>
            {loading ? (
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13.5, padding: '20px 0', justifyContent: 'center' }}>
                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
              </p>
            ) : recent.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: 13.5, textAlign: 'center', padding: '20px 0' }}>
                No saved eSources yet — run your first build.
              </p>
            ) : recent.map((s) => (
              <button
                key={s.id} className="lift" disabled={busyId === s.id} onClick={() => openStudy(s.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  marginTop: 6, borderRadius: 11, border: '1px solid #e8edf4', background: '#fafbfc',
                  cursor: busyId === s.id ? 'wait' : 'pointer', textAlign: 'left',
                }}
              >
                <span style={{ width: 34, height: 34, borderRadius: 9, background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Layers size={16} color="#2563eb" />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.studyTitle}
                  </span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>
                    {[s.protocolNumber, s.phase, `${s.visitCount} visits`, `${s.fieldCount} fields`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                  {new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionCard
            icon={<Sparkles size={17} color="#fff" />}
            iconBg="linear-gradient(135deg, #fb8c3b, #ea5e0b)"
            title="New Build"
            text="Upload a protocol + eCRF and let the AI build the structured eSource."
            onClick={onNewBuild}
          />
          <ActionCard
            icon={<FileText size={17} color="#fff" />}
            iconBg="linear-gradient(135deg, #8b5cf6, #6d28d9)"
            title="Import an eSource"
            text="Turn an existing eSource into a preferences template — the AI detects your conventions."
            onClick={onOpenTemplates}
          />
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: '1px solid #eaeef4',
  boxShadow: '0 12px 30px rgba(15,23,42,0.07), 0 3px 9px rgba(15,23,42,0.05)', overflow: 'hidden',
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

function StatCard({ icon, tint, label, value, loading, onClick }: {
  icon: React.ReactNode; tint: string; label: string; value: number; loading: boolean; onClick?: () => void;
}) {
  return (
    <div
      className={onClick ? 'lift' : undefined}
      onClick={onClick}
      style={{ ...card, padding: '16px 18px', cursor: onClick ? 'pointer' : 'default' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 9, background: `${tint}18`, color: tint, marginBottom: 10,
      }}>
        {icon}
      </span>
      <p style={{ fontSize: 24, fontWeight: 800, color: '#0b1220', letterSpacing: -0.6, lineHeight: 1 }}>
        {loading ? '—' : value.toLocaleString()}
      </p>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: 600 }}>{label}</p>
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
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>{text}</span>
      </span>
    </button>
  );
}
