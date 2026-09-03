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
  const headColor = mode === 'final' ? '#BE4A46' : mode === 'drafts' ? '#C9963D' : '#A02D24';

  return (
    <div className="anim-form" style={{
      maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 18,
      boxShadow: '0 18px 40px rgba(23,24,26,0.10), 0 4px 12px rgba(23,24,26,0.06)', border: '1px solid #E6E3DC',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid #EFECE5', display: 'flex', alignItems: 'center', gap: 10 }}>
        <HeadIcon size={18} color={headColor} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{heading}</h2>
        <span style={{ fontSize: 12, color: '#8A857B' }}>{sub}</span>
      </div>

      <div style={{ padding: '14px 22px 20px' }}>
        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#FBEDEB', border: '1px solid #F1CFCE', marginBottom: 12 }}>
            <AlertCircle size={15} color="#A02D24" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: '#A02D24', fontSize: 13 }}>{error}</p>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6E6A62', fontSize: 14, padding: '24px 0', justifyContent: 'center' }}>
            <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p style={{ color: '#8A857B', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
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
                border: '1px solid #E6E3DC', borderRadius: 12, background: '#FBFAF7',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: mode === 'final' ? '#EAF2ED' : mode === 'trash' ? '#FBEDEB' : '#FDF1F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {mode === 'final' ? <CheckCircle2 size={18} color="#2F6B4F" /> : mode === 'trash' ? <Trash2 size={18} color="#A02D24" /> : <Layers size={18} color="#BE4A46" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#17181A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studyTitle}</p>
                  <p style={{ fontSize: 11.5, color: '#8A857B', marginTop: 2 }}>
                    {[s.protocolNumber, s.phase, `${s.visitCount} visits`, `${s.fieldCount} fields`, s.createdAt && `Created ${fmtDate(s.createdAt)}`].filter(Boolean).join(' · ')}
                  </p>
                  {mode === 'drafts' && s.fieldCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ flex: 1, maxWidth: 220, height: 5, borderRadius: 4, background: '#E6E3DC' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4,
                          background: pct === 100 ? '#2F6B4F' : pct > 0 ? '#C9963D' : '#A02D24',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#2F6B4F' : '#8A6D3F' }}>
                        {approved}/{s.fieldCount} approved
                      </span>
                    </div>
                  )}
                </div>
                {mode === 'trash' ? (
                  <button className="lift" disabled={busyId === s.id} onClick={() => handleRestore(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid #D3E4D9',
                    background: '#EAF2ED', color: '#2F6B4F', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <RotateCcw size={13} /> Restore
                  </button>
                ) : (
                  <button className="lift" disabled={busyId === s.id} onClick={() => handleOpen(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, border: '1px solid #F1CFCE',
                    background: '#FDF1F1', color: '#BE4A46', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>
                    <FolderOpen size={13} /> Open
                  </button>
                )}
                <button className="lift" disabled={busyId === s.id} onClick={() => handleDelete(s.id)}
                  aria-label={mode === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                  title={mode === 'trash' ? 'Delete permanently' : 'Move to Trash'}
                  style={{
                    background: mode === 'trash' ? '#FBEDEB' : 'none', border: `1px solid ${mode === 'trash' ? '#F1CFCE' : '#E6E3DC'}`,
                    borderRadius: 9, padding: 7, cursor: 'pointer', color: mode === 'trash' ? '#A02D24' : '#8A857B', flexShrink: 0,
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
