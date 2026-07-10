import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Loader, Layers, AlertCircle, PenLine, CheckCircle2 } from 'lucide-react';
import { listStudies, getStudy, deleteStudy } from '../utils/api';
import type { StudyModel, StudySummary } from '../types/study';

interface StudyLibraryProps {
  onOpen: (study: StudyModel, id: string) => void;
  /** "final" = fully approved eSources; "drafts" = still in review. */
  mode: 'final' | 'drafts';
}

// Page listing saved studies (single shared workspace): open or delete.
// "My E-Sources" holds only fully-approved builds; everything else is a draft.
export default function StudyLibrary({ onOpen, mode }: StudyLibraryProps) {
  const [allItems, setAllItems] = useState<StudySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listStudies()
      .then(setAllItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
      .finally(() => setLoading(false));
  }, []);

  const items = allItems.filter((s) => (mode === 'final' ? s.status === 'final' : s.status !== 'final'));

  const handleOpen = async (id: string) => {
    setBusyId(id);
    try {
      onOpen(await getStudy(id), id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open study');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this saved study? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await deleteStudy(id);
      setAllItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete study');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="anim-form" style={{
      maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 18,
      boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', border: '1px solid #eaeef4',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 10 }}>
        {mode === 'final' ? <FolderOpen size={18} color="#2563eb" /> : <PenLine size={18} color="#f59e0b" />}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          {mode === 'final' ? 'My Saved E-Sources' : 'Drafts'}
        </h2>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {mode === 'final'
            ? `${items.length ? `${items.length} · ` : ''}fully approved builds`
            : `${items.length ? `${items.length} · ` : ''}partially reviewed — approve every field to promote`}
        </span>
      </div>

      <div style={{ padding: '14px 22px 20px' }}>
        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 }}>
            <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 14, padding: '24px 0', justifyContent: 'center' }}>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
            {mode === 'final'
              ? 'No fully-approved eSources yet. Approve every field in a draft, then “Save to E-Sources”.'
              : 'No drafts. Build an eSource and “Save draft” while reviewing.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((s) => {
              const approved = s.approvedFieldCount ?? 0;
              const pct = s.fieldCount ? Math.round((approved / s.fieldCount) * 100) : 0;
              return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                border: '1px solid #e8edf4', borderRadius: 12, background: '#fafbfc',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: mode === 'final' ? '#f0fdf4' : '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {mode === 'final' ? <CheckCircle2 size={18} color="#16a34a" /> : <Layers size={18} color="#2563eb" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studyTitle}</p>
                  <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                    {[s.protocolNumber, s.phase, `${s.visitCount} visits`, `${s.fieldCount} fields`].filter(Boolean).join(' · ')}
                  </p>
                  {mode === 'drafts' && s.fieldCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 220, height: 5, borderRadius: 4, background: '#e2e8f0' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4,
                          background: pct === 100 ? '#22c55e' : pct > 0 ? '#f59e0b' : '#ef4444',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#15803d' : '#b45309' }}>
                        {approved}/{s.fieldCount} approved
                      </span>
                    </div>
                  )}
                </div>
                <button className="lift" disabled={busyId === s.id} onClick={() => handleOpen(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid #bfdbfe',
                  background: '#eff6ff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}>
                  <FolderOpen size={13} /> Open
                </button>
                <button className="lift" disabled={busyId === s.id} onClick={() => handleDelete(s.id)} aria-label="Delete" style={{
                  background: 'none', border: '1px solid #e2e8f0', borderRadius: 9, padding: 7, cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
                }}>
                  <Trash2 size={14} />
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
