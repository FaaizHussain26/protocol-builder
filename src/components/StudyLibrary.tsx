import { useEffect, useState } from 'react';
import { X, FolderOpen, Trash2, Loader, Layers, AlertCircle } from 'lucide-react';
import { listStudies, getStudy, deleteStudy } from '../utils/api';
import type { StudyModel, StudySummary } from '../types/study';

interface StudyLibraryProps {
  open: boolean;
  onClose: () => void;
  onOpen: (study: StudyModel, id: string) => void;
}

// Modal listing saved studies (single shared workspace): open or delete.
export default function StudyLibrary({ open, onClose, onOpen }: StudyLibraryProps) {
  const [items, setItems] = useState<StudySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    listStudies()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load studies'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

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
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete study');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)',
        backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="anim-form"
        style={{
          width: 640, maxWidth: '100%', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(15,23,42,0.3)', border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FolderOpen size={18} color="#2563eb" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>My Saved E-Sources</h2>
          <button className="lift" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 22px', overflowY: 'auto' }}>
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
              No saved studies yet. Build a study and click “Save”.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  border: '1px solid #e8edf4', borderRadius: 12, background: '#fafbfc',
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Layers size={18} color="#2563eb" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.studyTitle}</p>
                    <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                      {[s.protocolNumber, s.phase, `${s.visitCount} visits`, `${s.fieldCount} fields`].filter(Boolean).join(' · ')}
                    </p>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
