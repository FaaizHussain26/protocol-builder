import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Layers, ClipboardCheck, AlertTriangle, FileOutput, RotateCcw,
  Check, X, Pencil, FlaskConical, ListChecks, Plus,
  PenLine, Upload, FileText, CircleDot, Save, Trash2, RefreshCw,
} from 'lucide-react';
import type {
  StudyModel, StudyField, StudyForm, StudyVisit, ReviewStatus,
} from '../types/study';
import { regenerateForm, saveStudy } from '../utils/api';
import { ALL_STANDARD_NAMES, canonicalRank } from '../utils/standardForms';
import { ConfidenceBadge, TypeBadge, Pill } from './ui';
import EligibilityPanel from './EligibilityPanel';
import FindingsPanel from './FindingsPanel';
import ExportPanel from './ExportPanel';
import FieldEditorDrawer from './FieldEditorDrawer';

// Identifies which field (or new field) the editor drawer is targeting.
interface EditTarget {
  formId: string;
  field: StudyField;
  isNew: boolean;
}

let newFieldCounter = 0;
function blankField(): StudyField {
  newFieldCounter += 1;
  return {
    id: `new-fld-${Date.now()}-${newFieldCounter}`,
    label: '',
    type: 'text',
    required: false,
    confidence: 'high',
    completionGuidance: '',
    source: 'Manually added',
    reviewStatus: 'accepted',
  };
}

let newFormCounter = 0;
function blankForm(): StudyForm {
  newFormCounter += 1;
  return { id: `new-form-${Date.now()}-${newFormCounter}`, name: 'New Form', appliedTemplate: null, fields: [], rules: [] };
}

let newVisitCounter = 0;
function blankVisit(): StudyVisit {
  newVisitCounter += 1;
  return { id: `new-visit-${Date.now()}-${newVisitCounter}`, name: 'New Visit', kind: 'visit', forms: [] };
}

const visitCtlBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
  background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0,
};

interface StudyBuilderProps {
  study: StudyModel;
  setStudy: (s: StudyModel) => void;
  onReset: () => void;
  /** Persisted study id (set once saved). */
  studyId?: string;
  /** Extracted source corpus, used to regenerate individual forms. */
  protocolText?: string;
  /** Called with the new id after a first save. */
  onStudyIdChange?: (id: string) => void;
}

type Tab = 'build' | 'eligibility' | 'intelligence' | 'export';

export default function StudyBuilder({ study, setStudy, onReset, studyId, protocolText, onStudyIdChange }: StudyBuilderProps) {
  const [tab, setTab] = useState<Tab>('build');
  const [activeVisitId, setActiveVisitId] = useState(study.visits[0]?.id ?? '');
  const [activeFormId, setActiveFormId] = useState(study.visits[0]?.forms[0]?.id ?? '');
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [regenId, setRegenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Reset the form panel's scroll to the top whenever the form/visit/tab changes,
  // so a freshly-selected form starts at its first question.
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeFormId, activeVisitId, tab]);

  // ---- Derived counts ----
  const stats = useMemo(() => {
    let total = 0, accepted = 0, rejected = 0, flagged = 0;
    for (const v of study.visits)
      for (const f of v.forms)
        for (const fld of f.fields) {
          total++;
          if (fld.reviewStatus === 'accepted') accepted++;
          else if (fld.reviewStatus === 'rejected') rejected++;
          if (fld.confidence === 'low' && fld.reviewStatus === 'pending') flagged++;
        }
    const openBlockers = study.findings.filter(f => f.severity === 'blocker' && !f.resolved).length;
    return { total, accepted, rejected, flagged, pending: total - accepted - rejected, openBlockers };
  }, [study]);

  // ---- Field mutations ----
  const mutateField = (formId: string, fieldId: string, patch: Partial<StudyField>) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : {
          ...f,
          fields: f.fields.map(fld => fld.id !== fieldId ? fld : { ...fld, ...patch }),
        }),
      })),
    });
  };

  const setRuleAccepted = (formId: string, ruleId: string, accepted: boolean) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : {
          ...f,
          rules: f.rules.map(r => r.id !== ruleId ? r : { ...r, accepted }),
        }),
      })),
    });
  };

  // Map over the fields of one form.
  const mapFormFields = (formId: string, fn: (fields: StudyField[]) => StudyField[]) => {
    setStudy({
      ...study,
      visits: study.visits.map(v => ({
        ...v,
        forms: v.forms.map(f => f.id !== formId ? f : { ...f, fields: fn(f.fields) }),
      })),
    });
  };

  // Insert or replace a field (called on drawer save).
  const saveField = (formId: string, field: StudyField, isNew: boolean) => {
    if (isNew) mapFormFields(formId, fields => [...fields, field]);
    else mapFormFields(formId, fields => fields.map(f => (f.id === field.id ? field : f)));
    setEditTarget(null);
  };

  const deleteField = (formId: string, fieldId: string) => {
    mapFormFields(formId, fields => fields.filter(f => f.id !== fieldId));
    setEditTarget(null);
  };

  const openEdit = (formId: string, field: StudyField) => setEditTarget({ formId, field, isNew: false });
  const openAdd = (formId: string) => setEditTarget({ formId, field: blankField(), isNew: true });

  // ---- Visit & form structure mutations ----
  const addVisit = () => {
    const v = blankVisit();
    setStudy({ ...study, visits: [...study.visits, v] });
    setActiveVisitId(v.id);
    setActiveFormId('');
  };
  const removeVisit = (visitId: string) => {
    const visits = study.visits.filter(v => v.id !== visitId);
    setStudy({ ...study, visits });
    if (activeVisitId === visitId) { setActiveVisitId(visits[0]?.id ?? ''); setActiveFormId(''); }
  };
  const renameVisit = (visitId: string, name: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, name }) });

  const addForm = (visitId: string, name?: string) => {
    const f = { ...blankForm(), name: name || 'New Form' };
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: [...v.forms, f] }) });
    setActiveFormId(f.id);
  };
  const sortFormsStandard = (visitId: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: [...v.forms].sort((a, b) => canonicalRank(a.name) - canonicalRank(b.name)) }) });
  const removeForm = (visitId: string, formId: string) =>
    setStudy({ ...study, visits: study.visits.map(v => v.id !== visitId ? v : { ...v, forms: v.forms.filter(f => f.id !== formId) }) });
  const updateForm = (formId: string, patch: Partial<StudyForm>) =>
    setStudy({ ...study, visits: study.visits.map(v => ({ ...v, forms: v.forms.map(f => f.id !== formId ? f : { ...f, ...patch }) })) });

  // Re-run enrichment for one form using its per-form prompt.
  const handleRegenerate = async (form: StudyForm) => {
    setRegenId(form.id);
    setSaveMsg(null);
    try {
      const { fields, rules } = await regenerateForm({
        formName: form.name,
        formDescription: form.description,
        studyTitle: study.studyTitle,
        indication: study.indication,
        protocolText,
        prompt: form.prompt,
      });
      updateForm(form.id, { fields, rules });
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Regenerate failed');
    } finally {
      setRegenId(null);
    }
  };

  // Persist the study (create or update).
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const saved = await saveStudy(study, studyId);
      if (saved.id && saved.id !== studyId) onStudyIdChange?.(saved.id);
      setStudy(saved);
      setSaveMsg('Saved');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const activeVisit = study.visits.find(v => v.id === activeVisitId) ?? study.visits[0];
  // Active form within the selected visit; falls back to the first form so a
  // visit change automatically lands on that visit's first form.
  const activeForm = activeVisit?.forms.find(f => f.id === activeFormId) ?? activeVisit?.forms[0];

  const TABS: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'build', label: 'Study Build', icon: <Layers size={15} /> },
    { id: 'eligibility', label: 'Eligibility', icon: <ListChecks size={15} />, badge: study.eligibility.length },
    { id: 'intelligence', label: 'Intelligence', icon: <AlertTriangle size={15} />, badge: study.findings.filter(f => !f.resolved).length },
    { id: 'export', label: 'Export', icon: <FileOutput size={15} /> },
  ];

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {/* Study header */}
      <div style={{
        background:
          'radial-gradient(640px 300px at 93% -35%, rgba(242,106,27,0.32) 0%, rgba(242,106,27,0) 62%),' +
          'linear-gradient(135deg, #0b1220 0%, #15233c 55%, #25364f 100%)',
        borderRadius: '22px 22px 0 0', padding: '28px 32px', color: '#fff',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <FlaskConical size={16} color="#f26a1b" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f26a1b', letterSpacing: 1, textTransform: 'uppercase' }}>
                Structured eSource Build
              </span>
            </div>
            <h1 style={{ fontSize: 23, fontWeight: 700, marginBottom: 8, letterSpacing: -0.4 }}>{study.studyTitle}</h1>
            <p style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.5, maxWidth: 680 }}>{study.studyDescription}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {study.protocolNumber && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">Protocol {study.protocolNumber}</Pill>}
              {study.phase && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.phase}</Pill>}
              {study.indication && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.indication}</Pill>}
              {study.sponsor && <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.sponsor}</Pill>}
              <Pill bg="rgba(255,255,255,0.12)" color="#e2e8f0">{study.documents.length} source doc{study.documents.length !== 1 ? 's' : ''}</Pill>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {saveMsg && (
              <span style={{ fontSize: 12, fontWeight: 600, color: saveMsg === 'Saved' ? '#4ade80' : '#fca5a5' }}>{saveMsg}</span>
            )}
            <button onClick={handleSave} disabled={saving} className="lift" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: '1px solid rgba(242,106,27,0.5)',
              background: 'rgba(242,106,27,0.9)', color: '#fff',
              cursor: saving ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 600,
            }}>
              <Save size={13} /> {saving ? 'Saving…' : studyId ? 'Save' : 'Save study'}
            </button>
            <button onClick={onReset} className="lift" style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 9, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
            }}>
              <RotateCcw size={13} /> New Build
            </button>
          </div>
        </div>

        {/* Review counter strip */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <CounterChip label="Fields" value={stats.total} color="#e2e8f0" />
          <CounterChip label="Approved" value={stats.accepted} color="#4ade80" />
          <CounterChip label="Flagged for review" value={stats.flagged} color="#fbbf24" />
          <CounterChip label="Pending" value={stats.pending} color="#cbd5e1" />
          {stats.openBlockers > 0 && <CounterChip label="Open blockers" value={stats.openBlockers} color="#f87171" />}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        background: '#fffbeb', borderBottom: '1px solid #fde68a',
        padding: '8px 32px', fontSize: 12, color: '#92400e',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={13} />
        Conceptual reference only. Every AI output is a draft a human approves — the production build will be more refined, customized, and aligned with final workflow and specifications.
      </div>

      {/* Tab nav */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        display: 'flex', padding: '0 20px', gap: 4,
      }}>
        {TABS.map(t => (
          <button key={t.id} className="tab-btn" onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600,
            color: tab === t.id ? '#2563eb' : '#64748b',
            borderBottom: `2px solid ${tab === t.id ? '#2563eb' : 'transparent'}`,
            marginBottom: -1,
          }}>
            {t.icon}{t.label}
            {t.badge ? (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                background: tab === t.id ? '#dbeafe' : '#f1f5f9',
                color: tab === t.id ? '#2563eb' : '#94a3b8',
              }}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Body — keyed by tab so each page switch replays the enter animation */}
      <div key={tab} className="anim-page" style={{
        background: '#fff', borderRadius: '0 0 22px 22px',
        boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)',
        border: '1px solid #eaeef4', borderTop: 'none', minHeight: 420,
      }}>
        {tab === 'build' && (
          <div>
            {/* Visit selector — visits live in a dropdown, not the side menu */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              padding: '16px 28px', borderBottom: '1px solid #e2e8f0', background: '#fafbfc',
            }}>
              <label htmlFor="visit-select" style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Visit
              </label>
              <select
                id="visit-select"
                value={activeVisit?.id ?? ''}
                onChange={e => { setActiveVisitId(e.target.value); setActiveFormId(''); }}
                style={{
                  padding: '9px 32px 9px 12px', borderRadius: 9, border: '1.5px solid #cbd5e1',
                  background: '#fff', fontSize: 14, fontWeight: 600, color: '#1e293b',
                  fontFamily: 'inherit', cursor: 'pointer', minWidth: 280, maxWidth: '100%',
                }}
              >
                {study.visits.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.timing ? ` — ${v.timing}` : ''}{v.kind === 'log' ? ' (log)' : ''}
                  </option>
                ))}
              </select>
              {activeVisit && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Pill>{activeVisit.kind === 'log' ? 'Continuous log' : 'Scheduled visit'}</Pill>
                  {activeVisit.window && <Pill bg="#eff6ff" color="#2563eb">Window {activeVisit.window}</Pill>}
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {activeVisit.forms.length} form{activeVisit.forms.length !== 1 ? 's' : ''} · {activeVisit.forms.reduce((a, f) => a + f.fields.length, 0)} fields
                  </span>
                </div>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                {activeVisit && (
                  <>
                    <button className="lift" title="Rename visit" onClick={() => {
                      const n = window.prompt('Rename visit', activeVisit.name);
                      if (n && n.trim()) renameVisit(activeVisit.id, n.trim());
                    }} style={visitCtlBtn}><Pencil size={13} /></button>
                    <button className="lift" title="Delete visit" onClick={() => {
                      if (window.confirm(`Delete visit "${activeVisit.name}" and its forms?`)) removeVisit(activeVisit.id);
                    }} style={visitCtlBtn}><Trash2 size={13} /></button>
                  </>
                )}
                <button className="lift" onClick={addVisit} style={{ ...visitCtlBtn, color: '#2563eb', borderColor: '#bfdbfe', width: 'auto', padding: '0 11px', gap: 6, fontWeight: 600, fontSize: 12.5 }}>
                  <Plus size={14} /> Visit
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', minHeight: 420 }}>
              {/* Forms side menu — the selected visit's form titles */}
              <div style={{
                width: 248, flexShrink: 0, borderRight: '1px solid #e2e8f0',
                padding: '16px 12px', background: '#fafbfc',
                maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase', padding: '0 8px', marginBottom: 10 }}>
                  Forms
                </p>
                {(activeVisit?.forms ?? []).map(f => {
                  const active = f.id === activeForm?.id;
                  return (
                    <button key={f.id} className="form-tab" onClick={() => setActiveFormId(f.id)} style={{
                      width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 4,
                      borderRadius: 9, border: 'none', cursor: 'pointer',
                      background: active ? '#eff6ff' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 9,
                    }}>
                      <span style={{ color: active ? '#2563eb' : '#94a3b8', flexShrink: 0 }}>
                        {f.appliedTemplate ? <CircleDot size={15} /> : <FileText size={15} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: active ? '#2563eb' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </span>
                        <span style={{ display: 'block', fontSize: 11, color: '#94a3b8' }}>
                          {f.fields.length} field{f.fields.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {activeVisit && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="lift" onClick={() => addForm(activeVisit.id)} style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      padding: '9px', borderRadius: 9, border: '1px dashed #cbd5e1',
                      background: '#fff', color: '#2563eb', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    }}>
                      <Plus size={14} /> Add blank form
                    </button>
                    <select
                      value=""
                      onChange={e => { if (e.target.value && activeVisit) { addForm(activeVisit.id, e.target.value); e.currentTarget.value = ''; } }}
                      style={{
                        width: '100%', padding: '9px', borderRadius: 9, border: '1px solid #e2e8f0',
                        background: '#fff', fontSize: 12.5, color: '#475569', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="">+ Add standard form…</option>
                      {ALL_STANDARD_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {/screen/i.test(activeVisit.name) && (
                      <button className="lift" onClick={() => sortFormsStandard(activeVisit.id)} style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        padding: '8px', borderRadius: 9, border: '1px solid #e2e8f0',
                        background: '#fafbfc', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>
                        <ListChecks size={13} /> Sort to standard order
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Active form — its headings (sections) and questions.
                  Keyed by form id so switching forms replays the enter animation. */}
              <div ref={contentRef} style={{
                flex: 1, padding: '22px 28px', minWidth: 0,
                maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
              }}>
                <div key={activeForm?.id ?? 'none'} className="anim-form">
                  {activeForm ? (
                    <FormBlock
                      form={activeForm}
                      onField={mutateField}
                      onRule={setRuleAccepted}
                      onEditField={openEdit}
                      onAddField={openAdd}
                      onUpdateForm={updateForm}
                      onRegenerate={handleRegenerate}
                      regenerating={regenId === activeForm.id}
                      onDeleteForm={() => activeVisit && removeForm(activeVisit.id, activeForm.id)}
                    />
                  ) : (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>This visit has no forms yet. Use “Add form” to create one.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'eligibility' && <EligibilityPanel eligibility={study.eligibility} />}
        {tab === 'intelligence' && (
          <FindingsPanel
            findings={study.findings}
            onResolve={(id, resolved) => setStudy({
              ...study,
              findings: study.findings.map(f => f.id === id ? { ...f, resolved } : f),
            })}
          />
        )}
        {tab === 'export' && <ExportPanel study={study} stats={stats} />}
      </div>

      <FieldEditorDrawer
        field={editTarget?.field ?? null}
        isNew={editTarget?.isNew ?? false}
        onSave={f => editTarget && saveField(editTarget.formId, f, editTarget.isNew)}
        onDelete={editTarget && !editTarget.isNew ? () => deleteField(editTarget.formId, editTarget.field.id) : undefined}
        onClose={() => setEditTarget(null)}
      />
    </div>
  );
}

function CounterChip({ label, value, color }: { label: string; value: number; color: string }) {
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

// Group a form's fields into ordered sections (preserving first-seen order) so
// the questionnaire renders as titled subsections. Fields with no section fall
// into a single leading unlabeled group.
function groupFieldsBySection(fields: StudyField[]): { key: string; section: string | null; fields: StudyField[] }[] {
  const order: (string | null)[] = [];
  const bySection = new Map<string | null, StudyField[]>();
  for (const f of fields) {
    const key = f.section?.trim() || null;
    if (!bySection.has(key)) { bySection.set(key, []); order.push(key); }
    bySection.get(key)!.push(f);
  }
  return order.map((section, i) => ({
    key: section ?? `__nosection_${i}`,
    section,
    fields: bySection.get(section)!,
  }));
}

function FormBlock({ form, onField, onRule, onEditField, onAddField, onUpdateForm, onRegenerate, regenerating, onDeleteForm }: {
  form: StudyForm;
  onField: (formId: string, fieldId: string, patch: Partial<StudyField>) => void;
  onRule: (formId: string, ruleId: string, accepted: boolean) => void;
  onEditField: (formId: string, field: StudyField) => void;
  onAddField: (formId: string) => void;
  onUpdateForm: (formId: string, patch: Partial<StudyForm>) => void;
  onRegenerate: (form: StudyForm) => void;
  regenerating: boolean;
  onDeleteForm: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
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
          <button className="lift" title="Customize prompt / regenerate" onClick={() => setShowPrompt(s => !s)} style={visitCtlBtn}>
            <RefreshCw size={13} color={showPrompt ? '#2563eb' : '#64748b'} />
          </button>
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
        {groupFieldsBySection(form.fields).map((group, gi) => (
          <div key={group.key} className="anim-row" style={{ animationDelay: `${Math.min(gi * 55, 280)}ms` }}>
            {group.section && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', background: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #eef2f7',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  {group.section}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                  {group.fields.length} question{group.fields.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {group.fields.map(field => (
              <FieldCard key={field.id} field={field}
                onChange={patch => onField(form.id, field.id, patch)}
                onEdit={() => onEditField(form.id, field)} />
            ))}
          </div>
        ))}
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

function FieldCard({ field, onChange, onEdit }: {
  field: StudyField;
  onChange: (patch: Partial<StudyField>) => void;
  onEdit: () => void;
}) {
  const flagged = field.confidence === 'low' && field.reviewStatus === 'pending';

  const statusBg: Record<ReviewStatus, string> = {
    pending: 'transparent', accepted: '#f0fdf4', rejected: '#fef2f2',
  };
  const leftBar: Record<ReviewStatus, string> = {
    pending: flagged ? '#f59e0b' : '#e2e8f0', accepted: '#22c55e', rejected: '#ef4444',
  };

  return (
    <div style={{
      padding: '14px 18px', borderBottom: '1px solid #f1f5f9',
      borderLeft: `3px solid ${leftBar[field.reviewStatus]}`,
      background: statusBg[field.reviewStatus],
      opacity: field.reviewStatus === 'rejected' ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
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

          <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <TypeBadge type={field.type} />
            <ConfidenceBadge level={field.confidence} compact />
            {flagged && <Pill bg="#fffbeb" color="#b45309"><AlertTriangle size={11} /> Needs review</Pill>}
            {(field.source || field.protocolSection || field.page != null) && (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                · {[field.source, field.protocolSection, field.page != null ? `p.${field.page}` : null].filter(Boolean).join(' · ')}
              </span>
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
          <SmallBtn active={field.reviewStatus === 'rejected'} activeBg="#fee2e2" activeFg="#b91c1c"
            onClick={() => onChange({ reviewStatus: 'rejected' })}><X size={13} /> Reject</SmallBtn>
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

  switch (field.type) {
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
        <div style={{ display: 'flex', gap: 18 }}>
          {['Yes', 'No'].map(o => (
            <label key={o} style={choice}>
              <input type="radio" name={field.id} disabled={disabled} style={{ accentColor: '#2563eb' }} /> {o}
            </label>
          ))}
        </div>
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
