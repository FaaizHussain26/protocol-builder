// Presentational components extracted from StudyBuilder — the visit/form/field
// tree, folders and settings panels, and their field-level building blocks.
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronDown, ClipboardCheck, Copy, CopyPlus, Folder, FolderTree,
  GripVertical, PenLine, Pencil, Plus, RefreshCw, Rows3, SlidersHorizontal, Split, Trash2, Upload, X,
} from 'lucide-react';
import type { ReviewStatus, StudyField, StudyForm, StudyVisit } from '../../types/study';
import { arrayMove } from '@dnd-kit/sortable';
import { SortableList, SortableRow } from '../dnd';
import { ConfidenceBadge, TypeBadge, Pill } from '../ui';
import { visitCtlBtn, reorderBtn, groupFieldsBySection } from './shared';

export function CounterChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '6px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.07)',
    }}>
      <span style={{ fontSize: 17, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{label}</span>
    </div>
  );
}


export function FormBlock({ form, filter, onField, onRule, onFormReview, onEditField, onAddField, onUpdateForm, onRegenerate, regenerating, onDeleteForm, onDuplicateForm, onReorderFields, onAddSection, onDuplicateContent, onDuplicateSection, onApplyToAllForms, onDuplicateField, onDeleteField, showFieldTypeBadge = true }: {
  form: StudyForm;
  filter: 'all' | ReviewStatus;
  onField: (formId: string, fieldId: string, patch: Partial<StudyField>) => void;
  onRule: (formId: string, ruleId: string, accepted: boolean) => void;
  onFormReview: (formId: string, status: ReviewStatus) => void;
  onEditField: (formId: string, field: StudyField) => void;
  onAddField: (formId: string) => void;
  onUpdateForm: (formId: string, patch: Partial<StudyForm>) => void;
  onRegenerate: (form: StudyForm) => void;
  regenerating: boolean;
  onDeleteForm: () => void;
  onDuplicateForm: () => void;
  onReorderFields: (formId: string, next: StudyField[]) => void;
  onAddSection: (formId: string) => void;
  onDuplicateContent: (formId: string) => void;
  onDuplicateSection: (formId: string, section: string | null) => void;
  onApplyToAllForms: (formId: string, section: string | null) => void;
  onDuplicateField: (formId: string, fieldId: string) => void;
  onDeleteField: (formId: string, fieldId: string) => void;
  /** Plan Mode: show the input-type badge under each field. */
  showFieldTypeBadge?: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const visibleFields = filter === 'all' ? form.fields : form.fields.filter(f => f.reviewStatus === filter);
  const hiddenCount = form.fields.length - visibleFields.length;
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 14, marginBottom: 18, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{form.name}</h3>
          {form.appliedTemplate && (
            <Pill bg="#f0fdf4" color="#15803d"><Check size={11} /> Template: {form.appliedTemplate}</Pill>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{form.fields.length} fields</span>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'accepted')}
            activeBg="#dcfce7" activeFg="#15803d"
            onClick={() => onFormReview(form.id, 'accepted')}><Check size={13} /> Approve all</SmallBtn>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'rejected')}
            activeBg="#fee2e2" activeFg="#b91c1c"
            onClick={() => onFormReview(form.id, 'rejected')}><X size={13} /> Reject all</SmallBtn>
          <SmallBtn active={false} onClick={() => onAddSection(form.id)}><Plus size={13} /> Add section</SmallBtn>
          <SmallBtn active={false} onClick={() => onDuplicateContent(form.id)}><CopyPlus size={13} /> Copy content</SmallBtn>
          <SmallBtn active={!!form.repeatable} activeBg="#eef2ff" activeFg="#4338ca"
            onClick={() => onUpdateForm(form.id, { repeatable: !form.repeatable })}><Rows3 size={13} /> Repeatable</SmallBtn>
          <button className="lift" title="Customize prompt / regenerate" onClick={() => setShowPrompt(s => !s)} style={visitCtlBtn}>
            <RefreshCw size={13} color={showPrompt ? '#2563eb' : '#64748b'} />
          </button>
          <button className="lift" title="Duplicate form" onClick={onDuplicateForm} style={visitCtlBtn}><Copy size={13} /></button>
          <button className="lift" title="Rename form" onClick={() => {
            const n = window.prompt('Rename form', form.name);
            if (n && n.trim()) onUpdateForm(form.id, { name: n.trim() });
          }} style={visitCtlBtn}><Pencil size={13} /></button>
          <button className="lift" title="Delete form" onClick={() => {
            if (window.confirm(`Delete form "${form.name}"?`)) onDeleteForm();
          }} style={visitCtlBtn}><Trash2 size={13} /></button>
        </div>
        {form.description && <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{form.description}</p>}
      </div>

      {/* Form header / instructions — free text shown at the top of the form */}
      <div style={{ padding: '10px 18px', background: '#fffdf5', borderBottom: '1px solid #f1f5f9' }}>
        <label style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', letterSpacing: 0.3, textTransform: 'uppercase' }}>Header / instructions</label>
        <textarea
          value={form.header ?? ''}
          onChange={e => onUpdateForm(form.id, { header: e.target.value })}
          placeholder="Add instructions or a header shown at the top of this form…"
          rows={form.header ? 2 : 1}
          style={{
            width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
            border: '1px solid #fde68a', background: '#fff', fontSize: 13, fontFamily: 'inherit',
            color: '#1e293b', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Per-form prompt + regenerate */}
      {showPrompt && (
        <div style={{ padding: '12px 18px', background: '#fbfcfe', borderBottom: '1px solid #eef2f7' }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Form instructions
          </label>
          <textarea
            value={form.prompt ?? ''}
            onChange={e => onUpdateForm(form.id, { prompt: e.target.value })}
            placeholder="Tell the AI how to (re)build this form — e.g. “add a Comments field”, “use 24-hour time”, “include all CTCAE grades”…"
            rows={2}
            style={{
              width: '100%', marginTop: 6, padding: '9px 11px', borderRadius: 9,
              border: '1.5px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit',
              color: '#1e293b', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="lift" disabled={regenerating} onClick={() => onRegenerate(form)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9,
              border: 'none', background: regenerating ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: regenerating ? 'wait' : 'pointer',
            }}>
              <RefreshCw size={13} style={regenerating ? { animation: 'spin 1s linear infinite' } : undefined} />
              {regenerating ? 'Regenerating…' : 'Regenerate this form'}
            </button>
          </div>
        </div>
      )}

      <div>
        {form.repeatable && (
          <div style={{
            padding: '8px 18px', background: '#eef2ff', borderBottom: '1px solid #e0e7ff',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4338ca', fontWeight: 600,
          }}>
            <Rows3 size={13} /> Repeatable form — the fields below define one record (Record 1); the site adds more records at data entry.
          </div>
        )}
        {hiddenCount > 0 && (
          <p style={{ padding: '8px 18px', fontSize: 12, color: '#94a3b8', background: '#fafbfc', borderBottom: '1px solid #f1f5f9' }}>
            {hiddenCount} field{hiddenCount !== 1 ? 's' : ''} hidden by the “{filter === 'accepted' ? 'Approved' : filter === 'pending' ? 'Pending' : 'Rejected'}” filter.
          </p>
        )}
        {(() => {
          // Reorder only in the unfiltered view, where order === true order.
          const canReorder = filter === 'all';
          const groups = groupFieldsBySection(visibleFields);

          const sectionHeader = (section: string, count: number, handle?: React.ReactNode) => (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: '#f1f5f9',
              borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #eef2f7',
            }}>
              {handle}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.4, textTransform: 'uppercase' }}>{section}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{count} question{count !== 1 ? 's' : ''}</span>
              {canReorder && (
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="lift" title={`Duplicate the “${section}” section in this form`} onClick={() => onDuplicateSection(form.id, section)} style={reorderBtn(false)}><Copy size={12} /></button>
                  <button className="lift" title={`Copy the “${section}” section to every form`} onClick={() => {
                    if (window.confirm(`Add the “${section}” section to every form in the study that doesn’t already have it?`)) onApplyToAllForms(form.id, section);
                  }} style={reorderBtn(false)}><CopyPlus size={12} /></button>
                </span>
              )}
            </div>
          );

          const fieldCard = (field: StudyField, handle?: React.ReactNode) => (
            <FieldCard field={field}
              onChange={patch => onField(form.id, field.id, patch)}
              onEdit={() => onEditField(form.id, field)}
              onDuplicate={() => onDuplicateField(form.id, field.id)}
              onDelete={() => onDeleteField(form.id, field.id)}
              dragHandle={handle}
              showFieldTypeBadge={showFieldTypeBadge} />
          );

          if (!canReorder) {
            return groups.map((group, gi) => (
              <div key={group.key} className="anim-row" style={{ animationDelay: `${Math.min(gi * 55, 280)}ms` }}>
                {group.section && sectionHeader(group.section, group.fields.length)}
                {group.fields.map(field => <div key={field.id}>{fieldCard(field)}</div>)}
              </div>
            ));
          }

          // One flat drag list of section headers + fields. Dragging a field
          // across a header moves it INTO that section; dragging a header moves
          // the whole section. Empty sections (a header with no following fields)
          // simply disappear, matching how sections are derived from fields.
          type Item = { id: string; kind: 'header'; section: string } | { id: string; kind: 'field'; field: StudyField };
          const items: Item[] = [];
          for (const g of groups) {
            if (g.section) items.push({ id: `sec::${g.section}`, kind: 'header', section: g.section });
            for (const f of g.fields) items.push({ id: f.id, kind: 'field', field: f });
          }
          const counts = new Map(groups.map(g => [g.section, g.fields.length]));

          const onReorder = (from: number, to: number) => {
            const next = arrayMove(items, from, to);
            let curSection: string | undefined = undefined;
            const out: StudyField[] = [];
            for (const it of next) {
              if (it.kind === 'header') curSection = it.section;
              else out.push({ ...it.field, section: curSection });
            }
            onReorderFields(form.id, out);
          };

          return (
            <SortableList ids={items.map(i => i.id)} onReorder={onReorder}>
              {items.map(it => (
                <SortableRow key={it.id} id={it.id}>
                  {({ setNodeRef, style, handleProps }) => {
                    const grip = (
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', alignItems: 'center', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}>
                        <GripVertical size={it.kind === 'header' ? 14 : 13} />
                      </span>
                    );
                    return (
                      <div ref={setNodeRef} style={style}>
                        {it.kind === 'header'
                          ? sectionHeader(it.section, counts.get(it.section) ?? 0, grip)
                          : fieldCard(it.field, grip)}
                      </div>
                    );
                  }}
                </SortableRow>
              ))}
            </SortableList>
          );
        })()}
        {form.repeatable && (
          <div style={{ padding: '10px 18px', borderTop: '1px dashed #e0e7ff', background: '#f5f7ff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8,
              border: '1px dashed #c7d2fe', color: '#6366f1', fontSize: 12.5, fontWeight: 600,
            }}>
              <Plus size={14} /> Add entry
            </span>
            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Records are added by site staff at data entry.</span>
          </div>
        )}
      </div>

      {/* Add field */}
      <button onClick={() => onAddField(form.id)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '11px', border: 'none', borderTop: '1px dashed #e2e8f0',
        background: '#fff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={15} /> Add field to {form.name}
      </button>

      {form.rules.length > 0 && (
        <div style={{ padding: '14px 18px', background: '#fafbff', borderTop: '1px solid #eef2f7' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardCheck size={13} /> Suggested edit checks
          </p>
          {form.rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
              borderBottom: '1px solid #eef2f7',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.4 }}>{rule.description}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <Pill bg="#f3e8ff" color="#7c3aed">{rule.ruleType}</Pill>
                  <ConfidenceBadge level={rule.confidence} compact />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SmallBtn active={rule.accepted === true} activeBg="#dcfce7" activeFg="#15803d"
                  onClick={() => onRule(form.id, rule.id, true)}><Check size={13} /> Accept</SmallBtn>
                <SmallBtn active={rule.accepted === false} activeBg="#fee2e2" activeFg="#b91c1c"
                  onClick={() => onRule(form.id, rule.id, false)}><X size={13} /> Reject</SmallBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      <FormAlerts form={form} onUpdateForm={onUpdateForm} />
    </div>
  );
}

const ALERT_COLORS: Record<'info' | 'warning' | 'critical', { bg: string; fg: string }> = {
  info: { bg: '#eff6ff', fg: '#2563eb' },
  warning: { bg: '#fffbeb', fg: '#b45309' },
  critical: { bg: '#fef2f2', fg: '#b91c1c' },
};
let newAlertCounter = 0;

function FormAlerts({ form, onUpdateForm }: { form: StudyForm; onUpdateForm: (formId: string, patch: Partial<StudyForm>) => void }) {
  const alerts = form.alerts ?? [];
  const setAlerts = (next: StudyForm['alerts']) => onUpdateForm(form.id, { alerts: next });

  const addAlert = () => {
    const message = window.prompt('Alert message (e.g. “Notify PI immediately if the AE is serious”)');
    if (!message || !message.trim()) return;
    newAlertCounter += 1;
    setAlerts([...alerts, { id: `al-${Date.now()}-${newAlertCounter}`, level: 'warning', message: message.trim() }]);
  };
  const cycleLevel = (id: string) =>
    setAlerts(alerts.map(a => a.id !== id ? a : { ...a, level: a.level === 'info' ? 'warning' : a.level === 'warning' ? 'critical' : 'info' }));
  const editAlert = (id: string) => {
    const a = alerts.find(x => x.id === id);
    const message = window.prompt('Edit alert message', a?.message);
    if (message !== null) setAlerts(alerts.map(x => x.id !== id ? x : { ...x, message }));
  };
  const removeAlert = (id: string) => setAlerts(alerts.filter(a => a.id !== id));

  return (
    <div style={{ padding: '14px 18px', background: '#fff', borderTop: '1px solid #eef2f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: alerts.length ? 10 : 0 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', letterSpacing: 0.4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} /> Alerts
        </p>
        <button className="lift" onClick={addAlert} style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          borderRadius: 7, border: '1px solid #fde68a', background: '#fffbeb', color: '#b45309',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}><Plus size={13} /> Add alert</button>
      </div>
      {alerts.map(a => {
        const c = ALERT_COLORS[a.level];
        const fld = a.fieldId ? form.fields.find(f => f.id === a.fieldId) : undefined;
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <button className="lift" onClick={() => cycleLevel(a.id)} title="Cycle severity" style={{
              border: 'none', cursor: 'pointer', padding: '3px 9px', borderRadius: 20,
              background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>{a.level}</button>
            <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>
              {a.message}
              {fld && <span style={{ fontSize: 11, color: '#94a3b8' }}> · on “{fld.label}”</span>}
            </span>
            <button className="lift" onClick={() => editAlert(a.id)} style={visitCtlBtn} aria-label="Edit alert"><Pencil size={12} /></button>
            <button className="lift" onClick={() => removeAlert(a.id)} style={visitCtlBtn} aria-label="Remove alert"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}

function FieldCard({ field, onChange, onEdit, onDuplicate, onDelete, dragHandle, showFieldTypeBadge = true }: {
  field: StudyField;
  onChange: (patch: Partial<StudyField>) => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  dragHandle?: React.ReactNode;
  showFieldTypeBadge?: boolean;
}) {
  const flagged = field.confidence === 'low' && field.reviewStatus === 'pending';

  // RAG coding: green = approved, amber = pending action, red = rejected.
  const statusBg: Record<ReviewStatus, string> = {
    pending: '#fffdf4', accepted: '#f0fdf4', rejected: '#fef2f2',
  };
  const leftBar: Record<ReviewStatus, string> = {
    pending: '#f59e0b', accepted: '#22c55e', rejected: '#ef4444',
  };

  return (
    <div style={{
      padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
      borderLeft: `3px solid ${leftBar[field.reviewStatus]}`,
      background: statusBg[field.reviewStatus],
      opacity: field.reviewStatus === 'rejected' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {dragHandle && (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>{dragHandle}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
            {field.label}
            {field.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
          </label>

          {field.completionGuidance && (
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 8px', lineHeight: 1.4 }}>
              {field.completionGuidance}
            </p>
          )}

          <div style={{ marginTop: field.completionGuidance ? 0 : 8 }}>
            <FieldInput field={field} disabled={field.reviewStatus === 'rejected'} />
          </div>

          {field.footnote && (
            <p style={{ fontSize: 11.5, color: '#64748b', margin: '6px 0 0', lineHeight: 1.45, fontStyle: 'italic' }}>
              {field.footnote}
            </p>
          )}

          <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            {showFieldTypeBadge && <TypeBadge type={field.type} />}
            <ConfidenceBadge level={field.confidence} compact />
            {flagged && <Pill bg="#fffbeb" color="#b45309"><AlertTriangle size={11} /> Needs review</Pill>}
            {field.alert && (
              <Pill bg={ALERT_COLORS[field.alert.level].bg} color={ALERT_COLORS[field.alert.level].fg}>
                <AlertTriangle size={11} /> {field.alert.message || 'Alert'}
              </Pill>
            )}
            {field.condition && (
              <Pill bg="#eef2ff" color="#4f46e5"><Split size={11} /> Conditional</Pill>
            )}
          </div>

          {field.originalText && (
            <p style={{
              fontSize: 11.5, color: '#94a3b8', marginTop: 6, paddingLeft: 8,
              borderLeft: '2px solid #e2e8f0', fontStyle: 'italic', lineHeight: 1.45,
            }}>
              “{field.originalText}”
            </p>
          )}
        </div>

        {/* Review controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <SmallBtn active={field.reviewStatus === 'accepted'} activeBg="#dcfce7" activeFg="#15803d"
            onClick={() => onChange({ reviewStatus: 'accepted' })}><Check size={13} /> Accept</SmallBtn>
          <SmallBtn active={false} onClick={onEdit}><Pencil size={13} /> Edit</SmallBtn>
          {onDuplicate && <SmallBtn active={false} onClick={onDuplicate}><Copy size={13} /> Copy</SmallBtn>}
          <SmallBtn active={field.reviewStatus === 'rejected'} activeBg="#fee2e2" activeFg="#b91c1c"
            onClick={() => onChange({ reviewStatus: 'rejected' })}><X size={13} /> Reject</SmallBtn>
          {onDelete && (
            <button onClick={onDelete} className="lift" title="Delete field" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
              padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid #fecaca', background: '#fff', color: '#dc2626',
              fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 78,
            }}><Trash2 size={13} /> Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Renders the actual data-entry control for a field, matching its type.
function FieldInput({ field, disabled }: { field: StudyField; disabled: boolean }) {
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: '1.5px solid #cbd5e1', background: disabled ? '#f8fafc' : '#fff',
    fontSize: 13.5, color: '#1e293b', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const choice: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
    color: disabled ? '#94a3b8' : '#334155', cursor: disabled ? 'default' : 'pointer',
  };
  const opts = field.options ?? [];
  const noOpts = <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No options defined.</span>;

  // A "dropdown" behaves as a single-choice select.
  const ftype = (field.type as string) === 'dropdown' ? 'select' : field.type;
  switch (ftype) {
    case 'textarea':
      return <textarea rows={2} disabled={disabled} placeholder="Enter response"
        style={{ ...base, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} />;
    case 'number':
    case 'integer':
      return <input type="number" step={field.type === 'integer' ? 1 : 'any'} disabled={disabled} placeholder="0" style={base} />;
    case 'decimal':
      return <input type="number" step="any" disabled={disabled} placeholder="0.0" style={base} />;
    case 'date':
      // When a template date format is set, preview it as a formatted text field.
      return field.format
        ? <input type="text" disabled={disabled} placeholder={field.format} style={base} />
        : <input type="date" disabled={disabled} style={base} />;
    case 'datetime':
      return field.format
        ? <input type="text" disabled={disabled} placeholder={field.format} style={base} />
        : <input type="datetime-local" disabled={disabled} style={base} />;
    case 'time':
      return <input type="time" disabled={disabled} style={base} />;
    case 'select':
      return (
        <select disabled={disabled} defaultValue="" style={base}>
          <option value="" disabled>Select…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="N/A">N/A</option>
        </select>
      );
    case 'multiselect':
    case 'checkbox':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="checkbox" disabled={disabled} style={{ accentColor: '#2563eb' }} /> {o}
            </label>
          )) : noOpts}
        </div>
      );
    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="radio" name={field.id} disabled={disabled} style={{ accentColor: '#2563eb' }} /> {o}
            </label>
          )) : noOpts}
        </div>
      );
    case 'yesno':
      return (
        <select disabled={disabled} defaultValue="" style={base}>
          <option value="" disabled>Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    case 'signature':
      return (
        <div style={{
          ...base, borderStyle: 'dashed', height: 56, display: 'flex',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          color: '#94a3b8', fontStyle: 'italic', cursor: disabled ? 'default' : 'pointer',
        }}>
          <PenLine size={15} /> Sign here
        </div>
      );
    case 'file':
      return (
        <div style={{
          ...base, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 8, color: '#64748b',
          cursor: disabled ? 'default' : 'pointer',
        }}>
          <Upload size={15} /> <span style={{ fontSize: 13 }}>Upload file</span>
        </div>
      );
    case 'calculated':
      return <input type="text" readOnly disabled
        placeholder={field.expression ? `= ${field.expression}` : 'Calculated value'}
        style={{ ...base, background: '#f8fafc', color: '#64748b', fontStyle: 'italic' }} />;
    case 'text':
    default:
      return <input type="text" disabled={disabled} placeholder="Enter response" style={base} />;
  }
}

// Visit selector — a custom dropdown (native <select> can't drag-sort options)
// whose items can be reordered by dragging the grip handle.
// Display order of the known arms in the tree; custom arms sort after these.
const ARM_ORDER: string[] = ['Study Visit', 'General', 'Unscheduled Visit', 'SAE', 'Early Termination', 'Reconsent'];
const armRank = (a?: string) => { const i = ARM_ORDER.indexOf(a ?? 'Study Visit'); return i === -1 ? ARM_ORDER.length : i; };
// Stable arm ordering: known arms first (canonical order), then custom arms in
// first-seen order so a newly created arm keeps its place.
function orderedArms(visits: StudyVisit[]): string[] {
  const seen: string[] = [];
  for (const v of visits) { const a = v.arm ?? 'Study Visit'; if (!seen.includes(a)) seen.push(a); }
  return seen.sort((a, b) => (armRank(a) - armRank(b)) || (seen.indexOf(a) - seen.indexOf(b)));
}

export function VisitPicker({ visits, activeVisitId, onSelect, onReorder }: {
  visits: StudyVisit[];
  activeVisitId: string;
  onSelect: (id: string) => void;
  onReorder: (fromId: string, toId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = visits.find(v => v.id === activeVisitId);
  const label = (v: StudyVisit) => `${v.name}${v.timing ? ` — ${v.timing}` : ''}${v.kind === 'log' ? ' (log)' : ''}`;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [open]);

  // Group visits into arms (folders) in canonical arm order.
  const arms = orderedArms(visits);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 280, maxWidth: '100%' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 9,
        border: '1.5px solid #cbd5e1', background: '#fff', fontSize: 14, fontWeight: 600, color: '#1e293b',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active ? `${active.arm ?? 'Study Visit'} › ${label(active)}` : 'Select visit'}
        </span>
        <ChevronDown size={16} color="#64748b" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, minWidth: 320,
          maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 10, boxShadow: '0 14px 34px rgba(15,23,42,0.20)', padding: 4,
        }}>
          {arms.map(arm => {
            const armVisits = visits.filter(v => (v.arm ?? 'Study Visit') === arm);
            const ids = armVisits.map(v => v.id);
            return (
              <div key={arm} style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px 2px' }}>{arm}</p>
                <SortableList ids={ids} onReorder={(from, to) => onReorder(ids[from], ids[to])}>
                  {armVisits.map(v => (
                    <SortableRow key={v.id} id={v.id}>
                      {({ setNodeRef, style, handleProps }) => (
                        <div ref={setNodeRef} style={{
                          ...style, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8,
                          background: v.id === activeVisitId ? '#eff6ff' : 'transparent',
                        }}>
                          <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', padding: '0 2px 0 5px', touchAction: 'none' }}>
                            <GripVertical size={14} />
                          </span>
                          <button onClick={() => { onSelect(v.id); setOpen(false); }} style={{
                            flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 8px', fontSize: 13.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {v.id === activeVisitId ? <Check size={14} color="#2563eb" style={{ flexShrink: 0 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(v)}</span>
                          </button>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </SortableList>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Folders tab — arms (main folders) → folders (visits). Create/rename arms,
// add/rename/delete folders, and drag folders across arms (a flat sortable list
// of arm-headers + folder-rows; the drop position sets each folder's arm).
export function FoldersPanel({ visits, onAddArm, onAddFolder, onRenameArm, onRenameFolder, onDeleteFolder, onReorder, onOpenFolder }: {
  visits: StudyVisit[];
  onAddArm: () => void;
  onAddFolder: (arm: string) => void;
  onRenameArm: (oldName: string, newName: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onReorder: (next: StudyVisit[]) => void;
  onOpenFolder: (id: string) => void;
}) {
  type Item = { kind: 'arm'; id: string; arm: string } | { kind: 'folder'; id: string; visit: StudyVisit };
  const items: Item[] = [];
  for (const arm of orderedArms(visits)) {
    items.push({ kind: 'arm', id: `arm::${arm}`, arm });
    for (const v of visits.filter(x => (x.arm ?? 'Study Visit') === arm)) items.push({ kind: 'folder', id: v.id, visit: v });
  }
  const onDrop = (from: number, to: number) => {
    const next = arrayMove(items, from, to);
    let cur = 'Study Visit';
    const out: StudyVisit[] = [];
    for (const it of next) {
      if (it.kind === 'arm') cur = it.arm;
      else out.push({ ...it.visit, arm: cur });
    }
    onReorder(out);
  };
  const grip = (handleProps: Record<string, unknown>) => (
    <span {...handleProps} title="Drag to reorder / move to another arm" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}><GripVertical size={15} /></span>
  );
  return (
    <div className="anim-form" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <FolderTree size={18} color="#2563eb" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Folders</h2>
        <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>Drag a folder onto another arm to move it. Arms are main folders.</span>
        <button className="lift" onClick={onAddArm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> New arm
        </button>
      </div>
      <SortableList ids={items.map(i => i.id)} onReorder={onDrop}>
        {items.map(it => (
          <SortableRow key={it.id} id={it.id}>
            {({ setNodeRef, style, handleProps }) => (
              it.kind === 'arm' ? (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginTop: 10, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>{it.arm}</span>
                  <button className="lift" title="Rename arm" onClick={() => { const n = window.prompt('Rename arm', it.arm); if (n) onRenameArm(it.arm, n); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Add folder to this arm" onClick={() => onAddFolder(it.arm)} style={{ ...miniIconBtn, width: 'auto', padding: '0 9px', gap: 5, color: '#2563eb', borderColor: '#bfdbfe', fontSize: 12, fontWeight: 600 }}><Plus size={13} /> Folder</button>
                </div>
              ) : (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginLeft: 20, marginTop: 4, background: '#fafbfc', border: '1px solid #e8edf4', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <Folder size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                  <button onClick={() => onOpenFolder(it.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#1e293b' }}>
                    {it.visit.name}
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}> · {it.visit.forms.length} form{it.visit.forms.length !== 1 ? 's' : ''}</span>
                  </button>
                  <button className="lift" title="Rename folder" onClick={() => { const n = window.prompt('Rename folder', it.visit.name); if (n && n.trim()) onRenameFolder(it.id, n.trim()); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Delete folder" onClick={() => { if (window.confirm(`Delete folder "${it.visit.name}" and its forms?`)) onDeleteFolder(it.id); }} style={{ ...miniIconBtn, color: '#dc2626', borderColor: '#fecaca' }}><Trash2 size={13} /></button>
                </div>
              )
            )}
          </SortableRow>
        ))}
      </SortableList>
    </div>
  );
}

const miniIconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 };

// eSource Settings tab — drag-reorder the answer options of dropdown/select
// fields in the active form.
export function SettingsPanel({ visits, activeVisitId, activeFormId, onReorderOptions }: {
  visits: StudyVisit[];
  activeVisitId: string;
  activeFormId: string;
  onReorderOptions: (formId: string, fieldId: string, options: string[]) => void;
}) {
  const visit = visits.find(v => v.id === activeVisitId) ?? visits[0];
  const form = visit?.forms.find(f => f.id === activeFormId) ?? visit?.forms[0];
  const isDropdown = (f: StudyField) => (f.type === 'select' || (f.type as string) === 'dropdown') && (f.options?.length ?? 0) > 0;
  const selects = (form?.fields ?? []).filter(isDropdown);

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14, border: '1px solid #e8edf4', padding: '14px 18px', marginBottom: 12,
  };

  return (
    <div className="anim-form" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <SlidersHorizontal size={18} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>eSource Settings</h2>
          <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>
            Drag to reorder the answer options of each dropdown field. Showing dropdowns for{' '}
            <b style={{ color: '#334155' }}>{form?.name ?? '—'}</b>{visit ? ` · ${visit.name}` : ''} — change the form in <b style={{ color: '#334155' }}>Study Build</b>.
          </p>
        </div>
      </div>

      {!form ? (
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No form selected.</p>
      ) : selects.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
          “{form.name}” has no dropdown fields to configure.
        </p>
      ) : (
        selects.map(field => (
          <div key={field.id} style={cardStyle}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{field.label}</p>
            <p style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>{field.options!.length} options · drag to reorder</p>
            <SortableList
              ids={field.options!.map((_, i) => `${field.id}-opt-${i}`)}
              onReorder={(from, to) => onReorderOptions(form.id, field.id, arrayMove(field.options!, from, to))}
            >
              {field.options!.map((opt, i) => (
                <SortableRow key={`${field.id}-opt-${i}`} id={`${field.id}-opt-${i}`}>
                  {({ setNodeRef, style, handleProps }) => (
                    <div ref={setNodeRef} style={{
                      ...style, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                      border: '1px solid #e8edf4', borderRadius: 9, background: '#fafbfc', marginBottom: 6,
                    }}>
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#cbd5e1', cursor: 'grab', touchAction: 'none' }}>
                        <GripVertical size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, color: '#1e293b' }}>{opt}</span>
                    </div>
                  )}
                </SortableRow>
              ))}
            </SortableList>
          </div>
        ))
      )}
    </div>
  );
}

function SmallBtn({ children, onClick, active, activeBg, activeFg }: {
  children: React.ReactNode; onClick: () => void;
  active: boolean; activeBg?: string; activeFg?: string;
}) {
  return (
    <button onClick={onClick} className="lift" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
      padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${active ? (activeFg ?? '#2563eb') + '40' : '#e2e8f0'}`,
      background: active ? (activeBg ?? '#dbeafe') : '#fff',
      color: active ? (activeFg ?? '#2563eb') : '#64748b',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 78,
    }}>
      {children}
    </button>
  );
}
