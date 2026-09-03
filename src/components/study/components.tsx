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
      <span style={{ fontSize: 11.5, color: '#8A857B' }}>{label}</span>
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
      border: '1px solid #E6E3DC', borderRadius: 14, marginBottom: 18, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 18px', background: '#FBFAF7', borderBottom: '1px solid #E6E3DC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#17181A' }}>{form.name}</h3>
          {form.appliedTemplate && (
            <Pill bg="#EAF2ED" color="#2F6B4F"><Check size={11} /> Template: {form.appliedTemplate}</Pill>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#8A857B' }}>{form.fields.length} fields</span>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'accepted')}
            activeBg="#EAF2ED" activeFg="#2F6B4F"
            onClick={() => onFormReview(form.id, 'accepted')}><Check size={13} /> Approve all</SmallBtn>
          <SmallBtn active={form.fields.length > 0 && form.fields.every(f => f.reviewStatus === 'rejected')}
            activeBg="#FBEDEB" activeFg="#973C38"
            onClick={() => onFormReview(form.id, 'rejected')}><X size={13} /> Reject all</SmallBtn>
          <SmallBtn active={false} onClick={() => onAddSection(form.id)}><Plus size={13} /> Add section</SmallBtn>
          <SmallBtn active={false} onClick={() => onDuplicateContent(form.id)}><CopyPlus size={13} /> Copy content</SmallBtn>
          <SmallBtn active={!!form.repeatable} activeBg="#FDF1F1" activeFg="#9C3733"
            onClick={() => onUpdateForm(form.id, { repeatable: !form.repeatable })}><Rows3 size={13} /> Repeatable</SmallBtn>
          <button className="lift" title="Customize prompt / regenerate" onClick={() => setShowPrompt(s => !s)} style={visitCtlBtn}>
            <RefreshCw size={13} color={showPrompt ? '#BE4A46' : '#6E6A62'} />
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
        {form.description && <p style={{ fontSize: 12.5, color: '#6E6A62', marginTop: 4 }}>{form.description}</p>}
      </div>

      {/* Form header / instructions — free text shown at the top of the form */}
      <div style={{ padding: '10px 18px', background: '#FBFAF7', borderBottom: '1px solid #F1EFEA' }}>
        <label style={{ fontSize: 10.5, fontWeight: 700, color: '#8A6D3F', letterSpacing: 0.3, textTransform: 'uppercase' }}>Header / instructions</label>
        <textarea
          value={form.header ?? ''}
          onChange={e => onUpdateForm(form.id, { header: e.target.value })}
          placeholder="Add instructions or a header shown at the top of this form…"
          rows={form.header ? 2 : 1}
          style={{
            width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8,
            border: '1px solid #E8D5AE', background: '#fff', fontSize: 13, fontFamily: 'inherit',
            color: '#17181A', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Per-form prompt + regenerate */}
      {showPrompt && (
        <div style={{ padding: '12px 18px', background: '#FBFAF7', borderBottom: '1px solid #EFECE5' }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: '#BE4A46', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Form instructions
          </label>
          <textarea
            value={form.prompt ?? ''}
            onChange={e => onUpdateForm(form.id, { prompt: e.target.value })}
            placeholder="Tell the AI how to (re)build this form — e.g. “add a Comments field”, “use 24-hour time”, “include all CTCAE grades”…"
            rows={2}
            style={{
              width: '100%', marginTop: 6, padding: '9px 11px', borderRadius: 9,
              border: '1.5px solid #DCD8CF', fontSize: 13, fontFamily: 'inherit',
              color: '#17181A', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="lift" disabled={regenerating} onClick={() => onRegenerate(form)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9,
              border: 'none', background: regenerating ? '#DCD8CF' : 'linear-gradient(135deg, #BE4A46, #9C3733)',
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
            padding: '8px 18px', background: '#FDF1F1', borderBottom: '1px solid #FDF1F1',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9C3733', fontWeight: 600,
          }}>
            <Rows3 size={13} /> Repeatable form — the fields below define one record (Record 1); the site adds more records at data entry.
          </div>
        )}
        {hiddenCount > 0 && (
          <p style={{ padding: '8px 18px', fontSize: 12, color: '#8A857B', background: '#FBFAF7', borderBottom: '1px solid #F1EFEA' }}>
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
              padding: '9px 18px', background: '#F1EFEA',
              borderBottom: '1px solid #E6E3DC', borderTop: '1px solid #EFECE5',
            }}>
              {handle}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#BE4A46', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#5C584F', letterSpacing: 0.4, textTransform: 'uppercase' }}>{section}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#8A857B' }}>{count} question{count !== 1 ? 's' : ''}</span>
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
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', alignItems: 'center', color: '#DCD8CF', cursor: 'grab', touchAction: 'none' }}>
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
          <div style={{ padding: '10px 18px', borderTop: '1px dashed #FDF1F1', background: '#FBFAF7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 8,
              border: '1px dashed #F1CFCE', color: '#BE4A46', fontSize: 12.5, fontWeight: 600,
            }}>
              <Plus size={14} /> Add entry
            </span>
            <span style={{ fontSize: 11.5, color: '#8A857B' }}>Records are added by site staff at data entry.</span>
          </div>
        )}
      </div>

      {/* Add field */}
      <button onClick={() => onAddField(form.id)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: '11px', border: 'none', borderTop: '1px dashed #E6E3DC',
        background: '#fff', color: '#BE4A46', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        <Plus size={15} /> Add field to {form.name}
      </button>

      {form.rules.length > 0 && (
        <div style={{ padding: '14px 18px', background: '#FBFAF7', borderTop: '1px solid #EFECE5' }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: '#BE4A46', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardCheck size={13} /> Suggested edit checks
          </p>
          {form.rules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
              borderBottom: '1px solid #EFECE5',
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, color: '#5C584F', lineHeight: 1.4 }}>{rule.description}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <Pill bg="#FDF1F1" color="#BE4A46">{rule.ruleType}</Pill>
                  <ConfidenceBadge level={rule.confidence} compact />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <SmallBtn active={rule.accepted === true} activeBg="#EAF2ED" activeFg="#2F6B4F"
                  onClick={() => onRule(form.id, rule.id, true)}><Check size={13} /> Accept</SmallBtn>
                <SmallBtn active={rule.accepted === false} activeBg="#FBEDEB" activeFg="#973C38"
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
  info: { bg: '#FDF1F1', fg: '#BE4A46' },
  warning: { bg: '#FBF6EC', fg: '#8A6D3F' },
  critical: { bg: '#FBEDEB', fg: '#973C38' },
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
    <div style={{ padding: '14px 18px', background: '#fff', borderTop: '1px solid #EFECE5' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: alerts.length ? 10 : 0 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: '#8A6D3F', letterSpacing: 0.4, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} /> Alerts
        </p>
        <button className="lift" onClick={addAlert} style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
          borderRadius: 7, border: '1px solid #E8D5AE', background: '#FBF6EC', color: '#8A6D3F',
          fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}><Plus size={13} /> Add alert</button>
      </div>
      {alerts.map(a => {
        const c = ALERT_COLORS[a.level];
        const fld = a.fieldId ? form.fields.find(f => f.id === a.fieldId) : undefined;
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F1EFEA' }}>
            <button className="lift" onClick={() => cycleLevel(a.id)} title="Cycle severity" style={{
              border: 'none', cursor: 'pointer', padding: '3px 9px', borderRadius: 20,
              background: c.bg, color: c.fg, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>{a.level}</button>
            <span style={{ flex: 1, fontSize: 13, color: '#5C584F' }}>
              {a.message}
              {fld && <span style={{ fontSize: 11, color: '#8A857B' }}> · on “{fld.label}”</span>}
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
    pending: '#FBFAF7', accepted: '#EAF2ED', rejected: '#FBEDEB',
  };
  const leftBar: Record<ReviewStatus, string> = {
    pending: '#C9963D', accepted: '#2F6B4F', rejected: '#A02D24',
  };

  return (
    <div style={{
      padding: '14px 18px', borderBottom: '1px solid #F1EFEA',
      borderLeft: `3px solid ${leftBar[field.reviewStatus]}`,
      background: statusBg[field.reviewStatus],
      opacity: field.reviewStatus === 'rejected' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {dragHandle && (
          <div style={{ flexShrink: 0, paddingTop: 2 }}>{dragHandle}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#17181A', lineHeight: 1.4 }}>
            {field.label}
            {field.required && <span style={{ color: '#A02D24', marginLeft: 4 }}>*</span>}
          </label>

          {field.completionGuidance && (
            <p style={{ fontSize: 12, color: '#8A857B', margin: '3px 0 8px', lineHeight: 1.4 }}>
              {field.completionGuidance}
            </p>
          )}

          <div style={{ marginTop: field.completionGuidance ? 0 : 8 }}>
            <FieldInput field={field} disabled={field.reviewStatus === 'rejected'} />
          </div>

          {field.footnote && (
            <p style={{ fontSize: 11.5, color: '#6E6A62', margin: '6px 0 0', lineHeight: 1.45, fontStyle: 'italic' }}>
              {field.footnote}
            </p>
          )}

          <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            {showFieldTypeBadge && <TypeBadge type={field.type} />}
            <ConfidenceBadge level={field.confidence} compact />
            {flagged && <Pill bg="#FBF6EC" color="#8A6D3F"><AlertTriangle size={11} /> Needs review</Pill>}
            {field.alert && (
              <Pill bg={ALERT_COLORS[field.alert.level].bg} color={ALERT_COLORS[field.alert.level].fg}>
                <AlertTriangle size={11} /> {field.alert.message || 'Alert'}
              </Pill>
            )}
            {field.condition && (
              <Pill bg="#FDF1F1" color="#9C3733"><Split size={11} /> Conditional</Pill>
            )}
          </div>

          {field.originalText && (
            <p style={{
              fontSize: 11.5, color: '#8A857B', marginTop: 6, paddingLeft: 8,
              borderLeft: '2px solid #E6E3DC', fontStyle: 'italic', lineHeight: 1.45,
            }}>
              “{field.originalText}”
            </p>
          )}
        </div>

        {/* Review controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <SmallBtn active={field.reviewStatus === 'accepted'} activeBg="#EAF2ED" activeFg="#2F6B4F"
            onClick={() => onChange({ reviewStatus: 'accepted' })}><Check size={13} /> Accept</SmallBtn>
          <SmallBtn active={false} onClick={onEdit}><Pencil size={13} /> Edit</SmallBtn>
          {onDuplicate && <SmallBtn active={false} onClick={onDuplicate}><Copy size={13} /> Copy</SmallBtn>}
          <SmallBtn active={field.reviewStatus === 'rejected'} activeBg="#FBEDEB" activeFg="#973C38"
            onClick={() => onChange({ reviewStatus: 'rejected' })}><X size={13} /> Reject</SmallBtn>
          {onDelete && (
            <button onClick={onDelete} className="lift" title="Delete field" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
              padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
              border: '1px solid #F1CFCE', background: '#fff', color: '#A02D24',
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
    border: '1.5px solid #DCD8CF', background: disabled ? '#FBFAF7' : '#fff',
    fontSize: 13.5, color: '#17181A', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const choice: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5,
    color: disabled ? '#8A857B' : '#5C584F', cursor: disabled ? 'default' : 'pointer',
  };
  const opts = field.options ?? [];
  const noOpts = <span style={{ fontSize: 12, color: '#8A857B', fontStyle: 'italic' }}>No options defined.</span>;

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
              <input type="checkbox" disabled={disabled} style={{ accentColor: '#BE4A46' }} /> {o}
            </label>
          )) : noOpts}
        </div>
      );
    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="radio" name={field.id} disabled={disabled} style={{ accentColor: '#BE4A46' }} /> {o}
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
          color: '#8A857B', fontStyle: 'italic', cursor: disabled ? 'default' : 'pointer',
        }}>
          <PenLine size={15} /> Sign here
        </div>
      );
    case 'file':
      return (
        <div style={{
          ...base, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 8, color: '#6E6A62',
          cursor: disabled ? 'default' : 'pointer',
        }}>
          <Upload size={15} /> <span style={{ fontSize: 13 }}>Upload file</span>
        </div>
      );
    case 'calculated':
      return <input type="text" readOnly disabled
        placeholder={field.expression ? `= ${field.expression}` : 'Calculated value'}
        style={{ ...base, background: '#FBFAF7', color: '#6E6A62', fontStyle: 'italic' }} />;
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
        border: '1.5px solid #DCD8CF', background: '#fff', fontSize: 14, fontWeight: 600, color: '#17181A',
        fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active ? `${active.arm ?? 'Study Visit'} › ${label(active)}` : 'Select visit'}
        </span>
        <ChevronDown size={16} color="#6E6A62" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, minWidth: 320,
          maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #E6E3DC',
          borderRadius: 10, boxShadow: '0 14px 34px rgba(23,24,26,0.20)', padding: 4,
        }}>
          {arms.map(arm => {
            const armVisits = visits.filter(v => (v.arm ?? 'Study Visit') === arm);
            const ids = armVisits.map(v => v.id);
            return (
              <div key={arm} style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: '#BE4A46', textTransform: 'uppercase', letterSpacing: 0.4, padding: '6px 8px 2px' }}>{arm}</p>
                <SortableList ids={ids} onReorder={(from, to) => onReorder(ids[from], ids[to])}>
                  {armVisits.map(v => (
                    <SortableRow key={v.id} id={v.id}>
                      {({ setNodeRef, style, handleProps }) => (
                        <div ref={setNodeRef} style={{
                          ...style, display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8,
                          background: v.id === activeVisitId ? '#FDF1F1' : 'transparent',
                        }}>
                          <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#DCD8CF', cursor: 'grab', padding: '0 2px 0 5px', touchAction: 'none' }}>
                            <GripVertical size={14} />
                          </span>
                          <button onClick={() => { onSelect(v.id); setOpen(false); }} style={{
                            flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 8px', fontSize: 13.5, color: '#17181A', display: 'flex', alignItems: 'center', gap: 8,
                          }}>
                            {v.id === activeVisitId ? <Check size={14} color="#BE4A46" style={{ flexShrink: 0 }} /> : <span style={{ width: 14, flexShrink: 0 }} />}
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
    <span {...handleProps} title="Drag to reorder / move to another arm" style={{ display: 'inline-flex', color: '#DCD8CF', cursor: 'grab', touchAction: 'none' }}><GripVertical size={15} /></span>
  );
  return (
    <div className="anim-form" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <FolderTree size={18} color="#BE4A46" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#17100F' }}>Folders</h2>
        <span style={{ fontSize: 12, color: '#8A857B', flex: 1 }}>Drag a folder onto another arm to move it. Arms are main folders.</span>
        <button className="lift" onClick={onAddArm} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, border: '1px solid #F1CFCE', background: '#FDF1F1', color: '#BE4A46', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> New arm
        </button>
      </div>
      <SortableList ids={items.map(i => i.id)} onReorder={onDrop}>
        {items.map(it => (
          <SortableRow key={it.id} id={it.id}>
            {({ setNodeRef, style, handleProps }) => (
              it.kind === 'arm' ? (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginTop: 10, background: '#F1EFEA', border: '1px solid #E6E3DC', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#BE4A46', textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>{it.arm}</span>
                  <button className="lift" title="Rename arm" onClick={() => { const n = window.prompt('Rename arm', it.arm); if (n) onRenameArm(it.arm, n); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Add folder to this arm" onClick={() => onAddFolder(it.arm)} style={{ ...miniIconBtn, width: 'auto', padding: '0 9px', gap: 5, color: '#BE4A46', borderColor: '#F1CFCE', fontSize: 12, fontWeight: 600 }}><Plus size={13} /> Folder</button>
                </div>
              ) : (
                <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginLeft: 20, marginTop: 4, background: '#FBFAF7', border: '1px solid #E6E3DC', borderRadius: 9 }}>
                  {grip(handleProps)}
                  <Folder size={14} color="#8A857B" style={{ flexShrink: 0 }} />
                  <button onClick={() => onOpenFolder(it.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#17181A' }}>
                    {it.visit.name}
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#8A857B' }}> · {it.visit.forms.length} form{it.visit.forms.length !== 1 ? 's' : ''}</span>
                  </button>
                  <button className="lift" title="Rename folder" onClick={() => { const n = window.prompt('Rename folder', it.visit.name); if (n && n.trim()) onRenameFolder(it.id, n.trim()); }} style={miniIconBtn}><Pencil size={13} /></button>
                  <button className="lift" title="Delete folder" onClick={() => { if (window.confirm(`Delete folder "${it.visit.name}" and its forms?`)) onDeleteFolder(it.id); }} style={{ ...miniIconBtn, color: '#A02D24', borderColor: '#F1CFCE' }}><Trash2 size={13} /></button>
                </div>
              )
            )}
          </SortableRow>
        ))}
      </SortableList>
    </div>
  );
}

const miniIconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #E6E3DC', background: '#fff', color: '#6E6A62', cursor: 'pointer', flexShrink: 0 };

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
    background: '#fff', borderRadius: 14, border: '1px solid #E6E3DC', padding: '14px 18px', marginBottom: 12,
  };

  return (
    <div className="anim-form" style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <SlidersHorizontal size={18} color="#BE4A46" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#17100F' }}>eSource Settings</h2>
          <p style={{ fontSize: 12.5, color: '#6E6A62', marginTop: 3, lineHeight: 1.5 }}>
            Drag to reorder the answer options of each dropdown field. Showing dropdowns for{' '}
            <b style={{ color: '#5C584F' }}>{form?.name ?? '—'}</b>{visit ? ` · ${visit.name}` : ''} — change the form in <b style={{ color: '#5C584F' }}>Study Build</b>.
          </p>
        </div>
      </div>

      {!form ? (
        <p style={{ color: '#8A857B', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>No form selected.</p>
      ) : selects.length === 0 ? (
        <p style={{ color: '#8A857B', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
          “{form.name}” has no dropdown fields to configure.
        </p>
      ) : (
        selects.map(field => (
          <div key={field.id} style={cardStyle}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: '#17181A', marginBottom: 4 }}>{field.label}</p>
            <p style={{ fontSize: 11.5, color: '#8A857B', marginBottom: 10 }}>{field.options!.length} options · drag to reorder</p>
            <SortableList
              ids={field.options!.map((_, i) => `${field.id}-opt-${i}`)}
              onReorder={(from, to) => onReorderOptions(form.id, field.id, arrayMove(field.options!, from, to))}
            >
              {field.options!.map((opt, i) => (
                <SortableRow key={`${field.id}-opt-${i}`} id={`${field.id}-opt-${i}`}>
                  {({ setNodeRef, style, handleProps }) => (
                    <div ref={setNodeRef} style={{
                      ...style, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
                      border: '1px solid #E6E3DC', borderRadius: 9, background: '#FBFAF7', marginBottom: 6,
                    }}>
                      <span {...handleProps} title="Drag to reorder" style={{ display: 'inline-flex', color: '#DCD8CF', cursor: 'grab', touchAction: 'none' }}>
                        <GripVertical size={15} />
                      </span>
                      <span style={{ fontSize: 13.5, color: '#17181A' }}>{opt}</span>
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
      border: `1px solid ${active ? (activeFg ?? '#BE4A46') + '40' : '#E6E3DC'}`,
      background: active ? (activeBg ?? '#FDF1F1') : '#fff',
      color: active ? (activeFg ?? '#BE4A46') : '#6E6A62',
      fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 78,
    }}>
      {children}
    </button>
  );
}
