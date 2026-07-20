import { useEffect, useState } from 'react';
import { X, Plus, Trash2, GripVertical, Save, AlertTriangle, Split } from 'lucide-react';
import type { StudyField, FieldType, Confidence, FieldCondition } from '../types/study';

interface FieldEditorDrawerProps {
  /** The field being edited, or null when closed. */
  field: StudyField | null;
  /** True when creating a brand-new field (changes title + hides delete). */
  isNew: boolean;
  /** Other fields in the same form — used as targets for conditional logic. */
  siblingFields?: StudyField[];
  onSave: (field: StudyField) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ALERT_LEVELS: { value: 'info' | 'warning' | 'critical'; label: string; color: string }[] = [
  { value: 'info', label: 'Info', color: '#2563eb' },
  { value: 'warning', label: 'Warning', color: '#b45309' },
  { value: 'critical', label: 'Critical', color: '#b91c1c' },
];

const CONDITION_OPS: { value: FieldCondition['operator']; label: string; needsValue: boolean }[] = [
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'not-equals', label: 'does not equal', needsValue: true },
  { value: 'is-not-empty', label: 'is answered', needsValue: false },
  { value: 'is-empty', label: 'is blank', needsValue: false },
];

const FIELD_TYPES: { value: FieldType; label: string; desc: string }[] = [
  { value: 'text', label: 'Short text', desc: 'Single-line text' },
  { value: 'textarea', label: 'Long text', desc: 'Multi-line text' },
  { value: 'integer', label: 'Integer', desc: 'Whole number' },
  { value: 'decimal', label: 'Decimal', desc: 'Number with decimals' },
  { value: 'number', label: 'Number', desc: 'Generic numeric value' },
  { value: 'date', label: 'Date', desc: 'Calendar date' },
  { value: 'datetime', label: 'Date & time', desc: 'Date and time' },
  { value: 'time', label: 'Time', desc: 'Time of day' },
  { value: 'yesno', label: 'Yes / No', desc: 'Boolean choice' },
  { value: 'radio', label: 'Single choice', desc: 'Pick one option' },
  { value: 'checkbox', label: 'Multi choice', desc: 'Pick several' },
  { value: 'select', label: 'Dropdown', desc: 'Pick one from a list' },
  { value: 'multiselect', label: 'Multi-select', desc: 'Pick many from a list' },
  { value: 'signature', label: 'Signature', desc: 'Sign-off capture' },
  { value: 'file', label: 'File upload', desc: 'Attach a document' },
  { value: 'calculated', label: 'Calculated', desc: 'Derived from a formula' },
];

const CONFIDENCE_OPTS: { value: Confidence; label: string; color: string }[] = [
  { value: 'high', label: 'High', color: '#16a34a' },
  { value: 'medium', label: 'Medium', color: '#ca8a04' },
  { value: 'low', label: 'Low (flag for review)', color: '#dc2626' },
];

const NEEDS_OPTIONS: FieldType[] = ['radio', 'checkbox', 'select', 'multiselect'];

export default function FieldEditorDrawer({ field, isNew, siblingFields = [], onSave, onDelete, onClose }: FieldEditorDrawerProps) {
  const [draft, setDraft] = useState<StudyField | null>(field);

  // Reset local draft whenever a different field is opened.
  useEffect(() => { setDraft(field); }, [field]);

  // Close on Escape.
  useEffect(() => {
    if (!field) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [field, onClose]);

  if (!field || !draft) return null;

  const set = (patch: Partial<StudyField>) => setDraft(d => (d ? { ...d, ...patch } : d));

  const changeType = (type: FieldType) => {
    const patch: Partial<StudyField> = { type };
    // Seed options when switching to a choice type that has none yet.
    if (NEEDS_OPTIONS.includes(type) && (!draft.options || draft.options.length === 0)) {
      patch.options = ['Option 1', 'Option 2'];
    }
    // Drop options when switching away from choice types.
    if (!NEEDS_OPTIONS.includes(type)) patch.options = undefined;
    set(patch);
  };

  const updateOption = (i: number, value: string) => {
    const opts = [...(draft.options ?? [])];
    opts[i] = value;
    set({ options: opts });
  };
  const addOption = () => set({ options: [...(draft.options ?? []), `Option ${(draft.options?.length ?? 0) + 1}`] });
  const removeOption = (i: number) => set({ options: (draft.options ?? []).filter((_, j) => j !== i) });

  const canSave = draft.label.trim().length > 0 &&
    (!NEEDS_OPTIONS.includes(draft.type) || (draft.options ?? []).filter(o => o.trim()).length >= 1);

  const save = () => {
    if (!canSave) return;
    const cleaned: StudyField = {
      ...draft,
      label: draft.label.trim(),
      options: NEEDS_OPTIONS.includes(draft.type)
        ? (draft.options ?? []).map(o => o.trim()).filter(Boolean)
        : undefined,
      // Drop an empty alert / an unwired condition so they don't clutter the field.
      alert: draft.alert && draft.alert.message.trim() ? { ...draft.alert, message: draft.alert.message.trim() } : undefined,
      condition: draft.condition && draft.condition.whenFieldId ? draft.condition : undefined,
    };
    onSave(cleaned);
  };

  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: '#334155', marginBottom: 7, display: 'block' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #e2e8f0',
    background: '#fff', fontSize: 13.5, color: '#1e293b', outline: 'none', fontFamily: 'inherit',
  };
  const addBlockBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8,
    border: '1.5px dashed #cbd5e1', background: '#fff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 200,
        animation: 'fadeIn 0.15s ease',
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '92vw',
        background: '#fff', zIndex: 201, boxShadow: '-8px 0 30px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {isNew ? 'Add Field' : 'Edit Field'}
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>Field properties</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Body (scroll) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {/* Label */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Field label</label>
            <input autoFocus value={draft.label} onChange={e => set({ label: e.target.value })}
              placeholder="e.g. Systolic Blood Pressure (mmHg)" style={inputStyle} />
          </div>

          {/* Type picker */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Field type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {FIELD_TYPES.map(t => {
                const active = draft.type === t.value;
                return (
                  <button key={t.value} onClick={() => changeType(t.value)} style={{
                    textAlign: 'left', padding: '9px 11px', borderRadius: 9, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
                    background: active ? '#eff6ff' : '#fff',
                  }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: active ? '#2563eb' : '#1e293b' }}>{t.label}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options editor */}
          {NEEDS_OPTIONS.includes(draft.type) && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Options</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(draft.options ?? []).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <GripVertical size={15} color="#cbd5e1" style={{ flexShrink: 0 }} />
                    <input value={opt} onChange={e => updateOption(i, e.target.value)}
                      style={{ ...inputStyle, padding: '7px 10px' }} placeholder={`Option ${i + 1}`} />
                    <button onClick={() => removeOption(i)} disabled={(draft.options?.length ?? 0) <= 1}
                      style={{
                        flexShrink: 0, background: 'none', border: 'none',
                        cursor: (draft.options?.length ?? 0) <= 1 ? 'not-allowed' : 'pointer',
                        color: (draft.options?.length ?? 0) <= 1 ? '#e2e8f0' : '#ef4444', padding: 4,
                      }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addOption} style={{
                marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, border: '1.5px dashed #cbd5e1',
                background: '#fff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>
                <Plus size={14} /> Add option
              </button>
            </div>
          )}

          {draft.type === 'yesno' && (
            <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 9, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Fixed options: <strong>Yes</strong> / <strong>No</strong></span>
            </div>
          )}

          {draft.type === 'signature' && (
            <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 9, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Captures a signature / sign-off (e.g. Informed Consent).</span>
            </div>
          )}

          {draft.type === 'file' && (
            <div style={{ marginBottom: 20, padding: '10px 12px', borderRadius: 9, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>Allows the site to attach a document or image.</span>
            </div>
          )}

          {draft.type === 'calculated' && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Calculation formula</label>
              <input value={draft.expression ?? ''} onChange={e => set({ expression: e.target.value })}
                placeholder="e.g. weight / (height/100)^2" style={inputStyle} />
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Value is derived automatically from this expression.</p>
            </div>
          )}

          {/* Section grouping */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Section <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
            <input value={draft.section ?? ''} onChange={e => set({ section: e.target.value })}
              placeholder="e.g. Anthropometry" style={inputStyle} />
          </div>

          {/* Required toggle */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Requirement</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ v: true, l: 'Required' }, { v: false, l: 'Optional' }].map(opt => (
                <button key={String(opt.v)} onClick={() => set({ required: opt.v })} style={{
                  flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                  border: `1.5px solid ${draft.required === opt.v ? '#2563eb' : '#e2e8f0'}`,
                  background: draft.required === opt.v ? '#eff6ff' : '#fff',
                  color: draft.required === opt.v ? '#2563eb' : '#64748b',
                  fontSize: 13, fontWeight: 600,
                }}>{opt.l}</button>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>AI confidence</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {CONFIDENCE_OPTS.map(c => {
                const active = draft.confidence === c.value;
                return (
                  <button key={c.value} onClick={() => set({ confidence: c.value })} style={{
                    flex: 1, padding: '9px 6px', borderRadius: 9, cursor: 'pointer',
                    border: `1.5px solid ${active ? c.color : '#e2e8f0'}`,
                    background: active ? c.color + '15' : '#fff',
                    color: active ? c.color : '#64748b', fontSize: 12, fontWeight: 600,
                  }}>{c.label}</button>
                );
              })}
            </div>
          </div>

          {/* Completion guidance */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Completion guidance</label>
            <textarea value={draft.completionGuidance ?? ''} onChange={e => set({ completionGuidance: e.target.value })}
              rows={3} placeholder="Plain instruction for site staff on how to complete this field..."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }} />
          </div>

          {/* Alert */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Alert <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
            {!draft.alert ? (
              <button onClick={() => set({ alert: { level: 'warning', message: '' } })} style={addBlockBtn}>
                <AlertTriangle size={14} /> Add alert
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {ALERT_LEVELS.map(lv => {
                    const active = draft.alert!.level === lv.value;
                    return (
                      <button key={lv.value} onClick={() => set({ alert: { ...draft.alert!, level: lv.value } })} style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        border: `1.5px solid ${active ? lv.color : '#e2e8f0'}`, background: active ? lv.color + '15' : '#fff',
                        color: active ? lv.color : '#64748b',
                      }}>{lv.label}</button>
                    );
                  })}
                  <button onClick={() => set({ alert: undefined })} title="Remove alert" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea value={draft.alert.message} onChange={e => set({ alert: { ...draft.alert!, message: e.target.value } })}
                  rows={2} placeholder="Alert message — e.g. “Notify the PI immediately if this value is clinically significant.”"
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 52, lineHeight: 1.5 }} />
              </div>
            )}
          </div>

          {/* Conditional logic */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Conditional logic <span style={{ color: '#94a3b8', fontWeight: 500 }}>(optional)</span></label>
            {!draft.condition ? (
              <>
                <button
                  onClick={() => set({ condition: { whenFieldId: siblingFields[0]?.id, operator: 'equals', value: '', action: 'show' } })}
                  disabled={siblingFields.length === 0}
                  style={{ ...addBlockBtn, opacity: siblingFields.length === 0 ? 0.5 : 1, cursor: siblingFields.length === 0 ? 'not-allowed' : 'pointer' }}>
                  <Split size={14} /> Add condition
                </button>
                {siblingFields.length === 0 && (
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Add another field to this form first to reference it.</p>
                )}
              </>
            ) : (() => {
              const cond = draft.condition;
              const needsValue = CONDITION_OPS.find(o => o.value === cond.operator)?.needsValue ?? false;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>When</span>
                    <select value={cond.whenFieldId ?? ''} onChange={e => set({ condition: { ...cond, whenFieldId: e.target.value } })}
                      style={{ ...inputStyle, flex: 1, minWidth: 120, padding: '7px 9px' }}>
                      {siblingFields.map(f => <option key={f.id} value={f.id}>{f.label || '(untitled field)'}</option>)}
                    </select>
                    <select value={cond.operator} onChange={e => set({ condition: { ...cond, operator: e.target.value as FieldCondition['operator'] } })}
                      style={{ ...inputStyle, width: 'auto', padding: '7px 9px' }}>
                      {CONDITION_OPS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {needsValue && (
                      <input value={cond.value ?? ''} onChange={e => set({ condition: { ...cond, value: e.target.value } })}
                        placeholder="value" style={{ ...inputStyle, flex: 1, minWidth: 90, padding: '7px 9px' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>then</span>
                    {([{ v: 'show', l: 'Show this field' }, { v: 'require', l: 'Make required' }] as const).map(a => {
                      const active = cond.action === a.v;
                      return (
                        <button key={a.v} onClick={() => set({ condition: { ...cond, action: a.v } })} style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`, background: active ? '#eef2ff' : '#fff',
                          color: active ? '#4f46e5' : '#64748b',
                        }}>{a.l}</button>
                      );
                    })}
                    <button onClick={() => set({ condition: undefined })} title="Remove condition" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Traceability */}
          <div style={{ marginBottom: 4 }}>
            <label style={labelStyle}>Traceability</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <input value={draft.source ?? ''} onChange={e => set({ source: e.target.value })}
                placeholder="Source document — e.g. XYZ-123_Protocol_v2.pdf" style={inputStyle} />
              <div style={{ display: 'flex', gap: 9 }}>
                <input value={draft.protocolSection ?? ''} onChange={e => set({ protocolSection: e.target.value })}
                  placeholder="Protocol section — §6.1" style={{ ...inputStyle, flex: 2 }} />
                <input type="number" value={draft.page ?? ''}
                  onChange={e => set({ page: e.target.value === '' ? undefined : Number(e.target.value) })}
                  placeholder="Page" style={{ ...inputStyle, flex: 1 }} />
              </div>
              <textarea value={draft.originalText ?? ''} onChange={e => set({ originalText: e.target.value })}
                rows={2} placeholder="Original text reference — short verbatim snippet from the source"
                style={{ ...inputStyle, resize: 'vertical', minHeight: 52, lineHeight: 1.5 }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {!isNew && onDelete && (
            <button onClick={onDelete} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px', borderRadius: 9, border: '1px solid #fecaca',
              background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 9, border: '1px solid #e2e8f0',
            background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={save} disabled={!canSave} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 9, border: 'none',
            background: canSave ? '#2563eb' : '#cbd5e1', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed',
          }}>
            <Save size={15} /> {isNew ? 'Add Field' : 'Save Changes'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}
