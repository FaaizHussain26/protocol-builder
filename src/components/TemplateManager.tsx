import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader, AlertCircle, SlidersHorizontal, ChevronLeft } from 'lucide-react';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, listQuestions, createQuestion, deleteQuestion } from '../utils/api';
import { sampleDate, renderDateSample } from '../utils/formatPrefs';
import { PREDEFINED_QUESTIONS } from '../utils/predefinedQuestions';
import { DEFAULT_PREFERENCES, type Template, type TemplatePreferences, type TemplateQuestion, type QuestionAnswerType } from '../types/study';
import EsourceImport from './EsourceImport';
import { ConfidenceBadge } from './ui';

interface TemplateManagerProps {
  onChanged?: () => void;
}

const DATE_PRESETS = ['DD-MMM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM YYYY', 'MMMM D, YYYY', 'YYYY', 'YY'];

const blankDraft = (): Template => ({ name: '', description: '', preferences: { ...DEFAULT_PREFERENCES } });

export default function TemplateManager({ onChanged }: TemplateManagerProps) {
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  // Custom question library (persisted) + the "add question" inputs.
  const [customQuestions, setCustomQuestions] = useState<TemplateQuestion[]>([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<QuestionAnswerType>('yesno');
  const [addingQ, setAddingQ] = useState(false);
  const [editorTab, setEditorTab] = useState<'basics' | 'questions' | 'prompt'>('basics');

  const reload = () => {
    setLoading(true);
    setError(null);
    listTemplates()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
    listQuestions().then(setCustomQuestions).catch(() => {});
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(null); reload(); }, []);

  // ---- Plan-Mode question selection ----
  const selectedQuestions = draft?.preferences.questions ?? [];
  const isSelected = (id: string) => selectedQuestions.some((q) => q.id === id);
  const toggleQuestion = (q: TemplateQuestion) =>
    setDraft((d) => {
      if (!d) return d;
      const cur = d.preferences.questions ?? [];
      const next = cur.some((x) => x.id === q.id) ? cur.filter((x) => x.id !== q.id) : [...cur, { ...q }];
      return { ...d, preferences: { ...d.preferences, questions: next } };
    });

  // Current Yes/No answer for a question (selected override → predefined default → "yes").
  const answerOf = (q: TemplateQuestion): 'yes' | 'no' =>
    selectedQuestions.find((x) => x.id === q.id)?.answer ?? q.answer ?? 'yes';

  // Set a Yes/No answer; auto-selects the question if not already selected.
  const setQuestionAnswer = (q: TemplateQuestion, answer: 'yes' | 'no') =>
    setDraft((d) => {
      if (!d) return d;
      const cur = d.preferences.questions ?? [];
      const next = cur.some((x) => x.id === q.id)
        ? cur.map((x) => (x.id === q.id ? { ...x, answer } : x))
        : [...cur, { ...q, answer }];
      return { ...d, preferences: { ...d.preferences, questions: next } };
    });

  // Select or clear every question in a group at once.
  const setGroupSelected = (list: TemplateQuestion[], on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const ids = new Set(list.map((q) => q.id));
      const cur = (d.preferences.questions ?? []).filter((x) => !ids.has(x.id));
      const next = on ? [...cur, ...list.map((q) => ({ ...q }))] : cur;
      return { ...d, preferences: { ...d.preferences, questions: next } };
    });

  const addCustomQuestion = async () => {
    if (!newQText.trim()) return;
    setAddingQ(true);
    setError(null);
    try {
      const q = await createQuestion({ text: newQText.trim(), answerType: newQType });
      setCustomQuestions((prev) => [q, ...prev]);
      toggleQuestion(q); // auto-select the new question
      setNewQText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add question');
    } finally {
      setAddingQ(false);
    }
  };

  const removeCustomQuestion = async (id: string) => {
    try {
      await deleteQuestion(id);
      setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
      setDraft((d) => (d ? { ...d, preferences: { ...d.preferences, questions: (d.preferences.questions ?? []).filter((q) => q.id !== id) } } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete question');
    }
  };

  const setPref = <K extends keyof TemplatePreferences>(key: K, value: TemplatePreferences[K]) =>
    setDraft((d) => (d ? { ...d, preferences: { ...d.preferences, [key]: value } } : d));

  const save = async () => {
    if (!draft || !draft.name.trim()) { setError('Template name is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: draft.name.trim(), description: draft.description, preferences: draft.preferences };
      if (draft.id) await updateTemplate(draft.id, payload);
      else await createTemplate(payload);
      setDraft(null);
      reload();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteTemplate(id);
      setItems((prev) => prev.filter((t) => t.id !== id));
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete template');
    }
  };

  const toggle = (key: keyof TemplatePreferences, label: string, hint: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', padding: '7px 0' }}>
      <input type="checkbox" checked={!!draft?.preferences[key]} onChange={(e) => setPref(key, e.target.checked as never)} style={{ accentColor: '#2563eb', marginTop: 2 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{hint}</span>
      </span>
    </label>
  );

  const editorTabs = [
    ['basics', 'Basics'],
    ['questions', `Questions${selectedQuestions.length ? ` (${selectedQuestions.length})` : ''}`],
    ['prompt', 'Prompt'],
  ] as const;

  // Predefined questions grouped by their group label (in definition order),
  // followed by the persisted Custom library. Questions imported from an
  // eSource carry their own group names — surface those too so they stay
  // visible (and deselectable) after import.
  const predefinedGroupNames = Array.from(new Set(PREDEFINED_QUESTIONS.map((q) => q.group)));
  const knownGroups = new Set([...predefinedGroupNames, 'Custom']);
  const importedGroupNames = Array.from(new Set(
    selectedQuestions.filter((q) => !knownGroups.has(q.group) && !customQuestions.some((c) => c.id === q.id)).map((q) => q.group),
  ));
  const questionGroups: { name: string; list: TemplateQuestion[] }[] = [
    ...importedGroupNames.map((name) => ({ name, list: selectedQuestions.filter((q) => q.group === name) })),
    ...predefinedGroupNames.map((name) => ({ name, list: PREDEFINED_QUESTIONS.filter((q) => q.group === name) })),
    { name: 'Custom', list: customQuestions },
  ];

  return (
    <div className="anim-form" style={{ maxWidth: draft ? 860 : 720, margin: '0 auto', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 18, boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', border: '1px solid #eaeef4', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: 10 }}>
          {draft && (
            <button className="lift" onClick={() => setDraft(null)} style={iconBtn} aria-label="Back"><ChevronLeft size={16} /></button>
          )}
          <SlidersHorizontal size={18} color="#2563eb" />
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{draft ? (draft.name.trim() || 'Plan Mode') : 'Preferences Templates'}</h2>
        </div>

        {/* Tabs (editor only) */}
        {draft && (
          <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid #eef2f7', background: '#fafbff' }}>
            {editorTabs.map(([id, label]) => (
              <button key={id} className="tab-btn" onClick={() => setEditorTab(id)} style={{
                padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 600,
                color: editorTab === id ? '#2563eb' : '#64748b', borderBottom: `2px solid ${editorTab === id ? '#2563eb' : 'transparent'}`, marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>
        )}

        {/* Scroll body */}
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 }}>
              <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>
            </div>
          )}

          {!draft ? (
            <>
              <button className="lift" onClick={() => { setEditorTab('basics'); setDraft(blankDraft()); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 14px', borderRadius: 10, border: '1px dashed #bfdbfe', background: '#eff6ff', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', justifyContent: 'center', marginBottom: 12 }}>
                <Plus size={15} /> New template
              </button>
              <EsourceImport onUseTemplate={(t) => { setEditorTab('basics'); setDraft(t); }} />
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 14, padding: '18px 0', justifyContent: 'center' }}>
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
                </div>
              ) : items.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '18px 0' }}>No templates yet. Create one to standardize form preferences.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map((t) => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid #e8edf4', borderRadius: 12, background: '#fafbfc' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>{t.name}</p>
                        <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                          Date {sampleDate(t.preferences)} · {t.preferences.timeFormat} · {(t.preferences.questions?.length ?? 0)} questions
                        </p>
                      </div>
                      <button className="lift" onClick={() => { setEditorTab('basics'); setDraft(structuredClone(t)); }} style={iconBtn} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="lift" onClick={() => t.id && remove(t.id)} style={iconBtn} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : editorTab === 'basics' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Name">
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Standard Phase 2 eSource" style={inputStyle} />
              </Field>
              <Field label="Description">
                <input value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional" style={inputStyle} />
              </Field>

              <Field label="Date format">
                <input value={draft.preferences.dateFormat ?? ''} onChange={(e) => setPref('dateFormat', e.target.value)} placeholder="e.g. YYYY-MM-DD" style={inputStyle} />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {DATE_PRESETS.map((f) => (
                    <button key={f} onClick={() => setPref('dateFormat', f)} style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${draft.preferences.dateFormat === f ? '#2563eb' : '#e2e8f0'}`,
                      background: draft.preferences.dateFormat === f ? '#eff6ff' : '#fff',
                      color: draft.preferences.dateFormat === f ? '#2563eb' : '#64748b',
                    }}>{f}</button>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Preview</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '5px 10px', borderRadius: 8 }}>{renderDateSample(draft.preferences.dateFormat ?? '') || '—'}</span>
                </div>
                <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                  Tokens: <b>YYYY</b>/<b>YY</b> year · <b>MMMM</b>/<b>MMM</b>/<b>MM</b>/<b>M</b> month · <b>DD</b>/<b>D</b> day. Other characters (- / space) are literal. Want only the year? Type <b>YY</b>.
                </p>
              </Field>

              <Field label="Time format">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['24h', '12h'] as const).map((tf) => (
                    <button key={tf} onClick={() => setPref('timeFormat', tf)} style={{
                      padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      border: `1.5px solid ${draft.preferences.timeFormat === tf ? '#2563eb' : '#e2e8f0'}`,
                      background: draft.preferences.timeFormat === tf ? '#eff6ff' : '#fff',
                      color: draft.preferences.timeFormat === tf ? '#2563eb' : '#64748b',
                    }}>{tf}</button>
                  ))}
                </div>
              </Field>

              <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 6 }}>
                {toggle('screeningOrder', 'Chronological Screening order', 'Order Screening forms: Date of Visit → Consent → Demographics → I/E → Eligibility → Vitals → PE → ECG → Labs → Progress Notes → Completion.')}
                {toggle('generalSections', 'General Sections', 'Add Medical History, Allergies, Social History, Adverse Events, Serious Adverse Events.')}
                {toggle('requireSignature', 'Require signature', 'Add an electronic signature field to consent/completion forms.')}
                {toggle('documentUploadFields', 'Allow document-upload fields', 'Permit file-upload fields (e.g. signed ICF).')}
              </div>
            </div>
          ) : editorTab === 'questions' ? (
            <div>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                Select questions/rules to feed into the build prompt and set each Yes/No answer. The Universal Rules apply by default;
                set one to <b>No</b> to disable it for this template. Custom questions you add are saved and reappear next time.
              </p>
              {questionGroups.map((grp) => {
                const selectedCount = grp.list.filter((q) => isSelected(q.id)).length;
                return (
                  <div key={grp.name} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.3, textTransform: 'uppercase' }}>{grp.name}</p>
                      {grp.list.length > 0 && (
                        <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{selectedCount}/{grp.list.length}</span>
                      )}
                      {grp.name !== 'Custom' && grp.list.length > 0 && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                          <button onClick={() => setGroupSelected(grp.list, true)} style={miniBtn}>Select all</button>
                          <button onClick={() => setGroupSelected(grp.list, false)} style={miniBtn}>Clear</button>
                        </div>
                      )}
                    </div>
                    {grp.name === 'Custom' && grp.list.length === 0 && (
                      <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 6 }}>No custom questions yet — add one below.</p>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 4 }}>
                      {grp.list.map((q) => (
                        <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: isSelected(q.id) ? '#eff6ff' : 'transparent', border: `1px solid ${isSelected(q.id) ? '#bfdbfe' : 'transparent'}` }}>
                          <input type="checkbox" checked={isSelected(q.id)} onChange={() => toggleQuestion(q)} style={{ accentColor: '#2563eb' }} />
                          <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{q.text}</span>
                          {q.confidence && <ConfidenceBadge level={q.confidence} compact />}
                          {q.answerType === 'yesno' ? (
                            <span style={{ display: 'inline-flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                              {(['yes', 'no'] as const).map((val) => {
                                const active = answerOf(q) === val && isSelected(q.id);
                                return (
                                  <span key={val} role="button" onClick={(e) => { e.preventDefault(); setQuestionAnswer(q, val); }} style={{
                                    padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    background: active ? (val === 'yes' ? '#16a34a' : '#dc2626') : '#fff',
                                    color: active ? '#fff' : '#94a3b8',
                                  }}>{val === 'yes' ? 'Yes' : 'No'}</span>
                                );
                              })}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', background: '#f1f5f9', padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{answerTypeLabel(q)}</span>
                          )}
                          {q.custom && (
                            <span role="button" onClick={(e) => { e.preventDefault(); if (q.id) removeCustomQuestion(q.id); }} style={{ color: '#cbd5e1', cursor: 'pointer', display: 'inline-flex' }} aria-label="Delete question"><Trash2 size={13} /></span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: 8, marginTop: 4, position: 'sticky', bottom: 0, background: '#fff', paddingTop: 8 }}>
                <input
                  value={newQText}
                  onChange={(e) => setNewQText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomQuestion(); } }}
                  placeholder="Add a custom question…"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <select value={newQType} onChange={(e) => setNewQType(e.target.value as QuestionAnswerType)} style={{ ...inputStyle, width: 'auto' }}>
                  {ANSWER_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <button className="lift" onClick={addCustomQuestion} disabled={addingQ || !newQText.trim()} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 9, border: 'none',
                  background: addingQ || !newQText.trim() ? '#cbd5e1' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: addingQ || !newQText.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                }}>
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>
                Prompt instructions (added to the AI build)
              </label>
              <textarea
                value={draft.preferences.instructions ?? ''}
                onChange={(e) => setPref('instructions', e.target.value)}
                placeholder={'Free-text directives that go straight into the prompt, e.g.\n• Use plain language a study coordinator understands.\n• For dates, write the month name out (e.g. “April 2026”).\n• Within Screening, keep Informed Consent before any procedure.\n• Add a “Comments” field to every form.\n• Capture all CTCAE grades on the Adverse Events form.'}
                style={{ ...inputStyle, flex: 1, minHeight: 340, resize: 'vertical', lineHeight: 1.55 }}
              />
              <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
                Appended to the build prompt (visits, forms, fields, and wording) every time this template is used.
              </p>
            </div>
          )}
        </div>

        {/* Sticky footer (editor only) */}
        {draft && (
          <div style={{ padding: '12px 22px', borderTop: '1px solid #eef2f7', background: '#fff', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedQuestions.length} question{selectedQuestions.length !== 1 ? 's' : ''} selected</span>
            <button className="lift" disabled={saving} onClick={save} style={{ marginLeft: 'auto', padding: '11px 22px', borderRadius: 11, border: 'none', background: saving ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create template'}
            </button>
          </div>
        )}
    </div>
  );
}

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', cursor: 'pointer', flexShrink: 0 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1.5px solid #cbd5e1', fontSize: 13.5, color: '#1e293b', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' };
const miniBtn: React.CSSProperties = { padding: '2px 8px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' };

const ANSWER_TYPES: { value: QuestionAnswerType; label: string }[] = [
  { value: 'yesno', label: 'Yes/No' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Multi-line' },
  { value: 'number', label: 'Number' },
  { value: 'preference', label: 'Preference' },
];
const answerTypeLabel = (q: TemplateQuestion): string => ANSWER_TYPES.find((a) => a.value === q.answerType)?.label ?? q.answerType;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#475569', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
