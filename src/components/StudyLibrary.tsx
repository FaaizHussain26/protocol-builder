import { useEffect, useState } from 'react';
import { FolderOpen, Trash2, Loader, Layers, AlertCircle, PenLine, CheckCircle2, RotateCcw } from 'lucide-react';
import { listStudies, listTrash, getStudy, deleteStudy, restoreStudy, permanentlyDeleteStudy } from '../utils/api';
import type { StudyModel, StudySummary } from '../types/study';

interface StudyLibraryProps {
  onOpen: (study: StudyModel, id: string) => void;
  /** "final" = approved eSources; "drafts" = in review; "trash" = soft-deleted. */
  mode: 'final' | 'drafts' | 'trash';
}

// Short absolute date for the created/updated stamps, e.g. "24 Aug 2026".
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Page listing saved studies (single shared workspace): open, trash, restore.
// "My E-Sources" holds fully-approved builds; drafts are in review; trash is
// soft-deleted studies that can be restored or permanently removed.
export default function StudyLibrary({ onOpen, mode }: StudyLibraryProps) {
  const [allItems, setAllItems] = useState<StudySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (mode === 'trash' ? listTrash() : listStudies())
      .then(setAllItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
      .finally(() => setLoading(false));
  }, [mode]);

  const items = mode === 'trash'
    ? allItems
    : allItems.filter((s) => (mode === 'final' ? s.status === 'final' : s.status !== 'final'));

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

  // Non-trash: soft delete → Trash. Trash: permanent delete.
  const handleDelete = async (id: string) => {
    if (mode === 'trash') {
      if (!window.confirm('Permanently delete this study? This cannot be undone.')) return;
    } else if (!window.confirm('Move this study to Trash? You can restore it later.')) return;
    setBusyId(id);
    try {
      if (mode === 'trash') await permanentlyDeleteStudy(id);
      else await deleteStudy(id);
      setAllItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete study');
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await restoreStudy(id);
      setAllItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to restore study');
    } finally {
      setBusyId(null);
    }
  };

  const heading = mode === 'final' ? 'My Saved E-Sources' : mode === 'drafts' ? 'Drafts' : 'Trash';
  const sub = mode === 'final'
    ? `${items.length ? `${items.length} · ` : ''}fully approved builds`
    : mode === 'drafts'
      ? `${items.length ? `${items.length} · ` : ''}partially reviewed — approve every field to promote`
      : `${items.length ? `${items.length} · ` : ''}deleted studies — restore or remove permanently`;
  const HeadIcon = mode === 'final' ? FolderOpen : mode === 'drafts' ? PenLine : Trash2;
  const headColor = mode === 'final' ? '#2563eb' : mode === 'drafts' ? '#f59e0b' : '#ef4444';

  return (
    <div className="anim-form" style={{
      maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 18,
      boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', border: '1px solid #eaeef4',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 10 }}>
        <HeadIcon size={18} color={headColor} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{heading}</h2>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</span>
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
              : mode === 'drafts'
                ? 'No drafts. Build an eSource and “Save draft” while reviewing.'
                : 'Trash is empty. Deleted studies appear here and can be restored.'}
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
                <div style={{ width: 38, height: 38, borderRadius: 10, background: mode === 'final' ? '#f0fdf4' : mode === 'trash' ? '#fef2f2' : '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {mode === 'final' ? <CheckCircle2 size={18} color="#16a34a" /> : mode === 'trash' ? <Trash2 size={18} color="#ef4444" /> : <Layers size={18} color="#2563eb" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studyTitle}</p>
                  <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                    {[s.protocolNumber, s.phase, `${s.visitCount} visits`, `${s.fieldCount} fields`, s.createdAt && `Created ${fmtDate(s.createdAt)}`].filter(Boolean).join(' · ')}
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
                {mode === 'trash' ? (
                  <button className="lift" disabled={busyId === s.id} onClick={() => handleRestore(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid #bbf7d0',
                    background: '#f0fdf4', color: '#15803d', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <RotateCcw size={13} /> Restore
                  </button>
                ) : (
                  <button className="lift" disabled={busyId === s.id} onClick={() => handleOpen(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid #bfdbfe',
                    background: '#eff6ff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <FolderOpen size={13} /> Open
                  </button>
                )}
                <button className="lift" disabled={busyId === s.id} onClick={() => handleDelete(s.id)}
                  aria-label={mode === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                  title={mode === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                  style={{
                    background: mode === 'trash' ? '#fef2f2' : 'none', border: `1px solid ${mode === 'trash' ? '#fecaca' : '#e2e8f0'}`,
                    borderRadius: 9, padding: 7, cursor: 'pointer', color: mode === 'trash' ? '#dc2626' : '#94a3b8', flexShrink: 0,
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
