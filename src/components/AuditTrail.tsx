// Phase 4: a read-only view of the append-only audit log — both
// study-definition (build) changes and form-submission changes, filterable
// by entity kind and user. Written to by the server (studies.service.ts's
// updateStudy diff, and dataCapture.controller.ts's submission writers);
// this component only ever reads.
import { useEffect, useMemo, useState } from 'react';
import { History, Layers, ClipboardList } from 'lucide-react';
import type { AuditLogEntry, AuditEntityType } from '../types/study';
import { listAuditLog } from '../utils/api';

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  added: { bg: '#EAF2ED', fg: '#2F6B4F' }, created: { bg: '#EAF2ED', fg: '#2F6B4F' },
  updated: { bg: '#F5EFD6', fg: '#6B4E28' },
  removed: { bg: '#FBEDEB', fg: '#973C38' },
  submitted: { bg: '#E9EEF9', fg: '#33538F' },
  signed: { bg: '#EAF2ED', fg: '#2F6B4F' },
};

export default function AuditTrail({ studyId }: { studyId?: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(() => !!studyId);
  const [error, setError] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<'all' | AuditEntityType>('all');
  const [userFilter, setUserFilter] = useState<string>('all');

  useEffect(() => {
    if (!studyId) return;
    listAuditLog(studyId)
      .then(setEntries)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load audit trail.'))
      .finally(() => setLoading(false));
  }, [studyId]);

  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.userId) map.set(e.userId, e.userName ?? e.userId);
    return Array.from(map.entries());
  }, [entries]);

  const filtered = entries.filter(e =>
    (entityFilter === 'all' || e.entityType === entityFilter) &&
    (userFilter === 'all' || e.userId === userFilter));

  if (!studyId) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#8A857B', fontSize: 13.5 }}>
        Save this eSource to start recording an audit trail.
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', background: '#fff', border: '1px solid #E6E3DC', borderRadius: 9, padding: 3 }}>
          {([
            { key: 'all', label: 'All changes' },
            { key: 'field', label: 'Build changes' },
            { key: 'form-submission-record', label: 'Submissions' },
          ] as const).map(f => {
            const active = entityFilter === f.key;
            return (
              <button key={f.key} onClick={() => setEntityFilter(f.key)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 7, border: 'none', cursor: 'pointer',
                background: active ? '#FDF1F1' : 'transparent',
                color: active ? '#BE4A46' : '#8A857B', fontSize: 12, fontWeight: 700,
              }}>{f.label}</button>
            );
          })}
        </div>
        {users.length > 0 && (
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{
            padding: '7px 10px', borderRadius: 9, border: '1.5px solid #DCD8CF', fontSize: 12.5, color: '#5C584F', outline: 'none',
          }}>
            <option value="all">All users</option>
            {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      {error && <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 9, background: '#FBEDEB', color: '#973C38', fontSize: 12.5 }}>{error}</div>}

      {loading ? (
        <p style={{ color: '#8A857B', fontSize: 13 }}>Loading audit trail…</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8A857B', fontSize: 13 }}>
          <History size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No changes recorded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(e => {
            const color = ACTION_COLORS[e.action] ?? { bg: '#F1EFEA', fg: '#5C584F' };
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px', borderRadius: 10, border: '1px solid #E6E3DC', background: '#fff' }}>
                <div style={{ marginTop: 2, color: '#8A857B' }}>
                  {e.entityType === 'field' ? <Layers size={14} /> : <ClipboardList size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 20, background: color.bg, color: color.fg, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{e.action}</span>
                    <span style={{ fontSize: 13, color: '#17181A' }}>{e.summary}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: '#8A857B', marginTop: 4 }}>
                    {e.userName ?? 'Unknown user'} · {fmt(e.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
