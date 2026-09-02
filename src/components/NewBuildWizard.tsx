import { useEffect, useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileOutput, FileText,
  Layers, Plus, Sparkles, Trash2,
} from 'lucide-react';
import DocumentUploadBox from './DocumentUploadBox';
import { listQuestions, createQuestion, deleteQuestion } from '../utils/api';
import { renderDateSample } from '../utils/formatPrefs';
import { UNIVERSAL_QUESTIONS, UNIVERSAL_GROUPS } from '../utils/universalRules';
import type { QuestionAnswerType, TemplatePreferences, TemplateQuestion } from '../types/study';

export type WizardStep = 1 | 2 | 3;

interface NewBuildWizardProps {
  prefs: TemplatePreferences;
  onPrefsChange: (prefs: TemplatePreferences) => void;
  protocolFiles: File[];
  onProtocolFilesChange: (files: File[]) => void;
  ecrfFiles: File[];
  onEcrfFilesChange: (files: File[]) => void;
  onBuild: () => void;
  error?: string | null;
}

const DATE_PRESETS = ['DD-MMM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM YYYY', 'MMMM D, YYYY', 'YYYY', 'YY'];
const DETAIL_LEVELS = ['high', 'medium', 'low'] as const;
type DetailLevel = (typeof DETAIL_LEVELS)[number];

const STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: 'Plan Mode' },
  { n: 2, label: 'Universal Rules' },
  { n: 3, label: 'Documents' },
];

export default function NewBuildWizard({
  prefs, onPrefsChange,
  protocolFiles, onProtocolFilesChange,
  ecrfFiles, onEcrfFilesChange,
  onBuild, error,
}: NewBuildWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [customQuestions, setCustomQuestions] = useState<TemplateQuestion[]>([]);
  const [newQText, setNewQText] = useState('');
  const [newQType, setNewQType] = useState<QuestionAnswerType>('yesno');
  const [addingQ, setAddingQ] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  // Universal Rules is long (~224) — groups start collapsed.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    listQuestions().then(setCustomQuestions).catch(() => {});
  }, []);

  const setPref = <K extends keyof TemplatePreferences>(key: K, value: TemplatePreferences[K]) =>
    onPrefsChange({ ...prefs, [key]: value });

  const selectedQuestions = prefs.questions ?? [];
  const isSelected = (id: string) => selectedQuestions.some((q) => q.id === id);

  const toggleQuestion = (q: TemplateQuestion) => {
    const cur = prefs.questions ?? [];
    const next = cur.some((x) => x.id === q.id) ? cur.filter((x) => x.id !== q.id) : [...cur, { ...q }];
    setPref('questions', next);
  };

  const answerOf = (q: TemplateQuestion): 'yes' | 'no' =>
    selectedQuestions.find((x) => x.id === q.id)?.answer ?? q.answer ?? 'yes';

  const setQuestionAnswer = (q: TemplateQuestion, answer: 'yes' | 'no') => {
    const cur = prefs.questions ?? [];
    const next = cur.some((x) => x.id === q.id)
      ? cur.map((x) => (x.id === q.id ? { ...x, answer } : x))
      : [...cur, { ...q, answer }];
    setPref('questions', next);
  };

  const setGroupSelected = (list: TemplateQuestion[], on: boolean) => {
    const ids = new Set(list.map((q) => q.id));
    const cur = (prefs.questions ?? []).filter((x) => !ids.has(x.id));
    setPref('questions', on ? [...cur, ...list.map((q) => ({ ...q }))] : cur);
  };

  const addCustomQuestion = async () => {
    if (!newQText.trim()) return;
    setAddingQ(true);
    setQError(null);
    try {
      const q = await createQuestion({ text: newQText.trim(), answerType: newQType });
      setCustomQuestions((prev) => [q, ...prev]);
      toggleQuestion(q);
      setNewQText('');
    } catch (e) {
      setQError(e instanceof Error ? e.message : 'Failed to add question');
    } finally {
      setAddingQ(false);
    }
  };

  const removeCustomQuestion = async (id: string) => {
    try {
      await deleteQuestion(id);
      setCustomQuestions((prev) => prev.filter((q) => q.id !== id));
      setPref('questions', (prefs.questions ?? []).filter((q) => q.id !== id));
    } catch (e) {
      setQError(e instanceof Error ? e.message : 'Failed to delete question');
    }
  };

  const toggle = (key: keyof TemplatePreferences, label: string, hint: string) => (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', padding: '7px 0' }}>
      <input type="checkbox" checked={!!prefs[key]} onChange={(e) => setPref(key, e.target.checked as never)} style={{ accentColor: '#2563eb', marginTop: 2 }} />
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#94a3b8' }}>{hint}</span>
      </span>
    </label>
  );

  // Confirmation gate: every mandatory answer has a default, so Next is enabled
  // unless the user clears a required value (currently just date format).
  const step1Ready = !!(prefs.dateFormat?.trim()) && (prefs.timeFormat === '12h' || prefs.timeFormat === '24h');
  const canGoTo = (n: WizardStep) => n <= wizardStep || (n > 1 && step1Ready);

  const questionGroups: { name: string; list: TemplateQuestion[] }[] = [
    ...UNIVERSAL_GROUPS.map((name) => ({ name, list: UNIVERSAL_QUESTIONS.filter((q) => q.group === name) })),
    { name: 'Custom', list: customQuestions },
  ];

  const allFiles = [...protocolFiles, ...ecrfFiles];

  return (
    <>
      <div className="float-in" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 18, flexWrap: 'wrap', marginBottom: 18,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1220', letterSpacing: -0.5 }}>New Build</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {[
            { icon: <FileText size={12} />, text: 'Ingestion' },
            { icon: <Layers size={12} />, text: 'Build' },
            { icon: <CheckCircle2 size={12} />, text: 'Review' },
            { icon: <AlertTriangle size={12} />, text: 'Intelligence' },
            { icon: <FileOutput size={12} />, text: 'Export' },
          ].map(({ icon, text }, i) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(226,232,240,0.9)', fontSize: 11.5, fontWeight: 600, color: '#475569',
              }}>
                <span style={{ color: i === 1 ? '#f26a1b' : '#2563eb', display: 'inline-flex' }}>{icon}</span> {text}
              </div>
              {i < 4 && <span style={{ color: '#cbd5e1', fontSize: 12 }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Clickable stepper */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {STEPS.map(({ n, label }, i) => {
          const active = wizardStep === n;
          const done = wizardStep > n;
          const allowed = canGoTo(n);
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => allowed && setWizardStep(n)}
                disabled={!allowed}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 20, cursor: allowed ? 'pointer' : 'not-allowed',
                  border: `1.5px solid ${active ? '#2563eb' : done ? '#bbf7d0' : '#e2e8f0'}`,
                  background: active ? '#eff6ff' : done ? '#f0fdf4' : '#fff',
                  color: active ? '#2563eb' : done ? '#15803d' : '#94a3b8',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 11,
                  background: active ? '#2563eb' : done ? '#16a34a' : '#e2e8f0',
                  color: active || done ? '#fff' : '#64748b',
                }}>{n}</span>
                {label}
              </button>
              {i < STEPS.length - 1 && <span style={{ color: '#cbd5e1', fontSize: 14 }}>→</span>}
            </div>
          );
        })}
      </div>

      {wizardStep === 1 && (
        <div style={card}>
          <div style={{ padding: '20px 26px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Plan Mode</p>
              <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.5 }}>
                Confirm how this eSource should be built. Defaults are already set — Next confirms them.
              </p>
            </div>

            <Field label="Date format">
              <input value={prefs.dateFormat ?? ''} onChange={(e) => setPref('dateFormat', e.target.value)} placeholder="e.g. YYYY-MM-DD" style={inputStyle} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {DATE_PRESETS.map((f) => (
                  <button key={f} type="button" onClick={() => setPref('dateFormat', f)} style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${prefs.dateFormat === f ? '#2563eb' : '#e2e8f0'}`,
                    background: prefs.dateFormat === f ? '#eff6ff' : '#fff',
                    color: prefs.dateFormat === f ? '#2563eb' : '#64748b',
                  }}>{f}</button>
                ))}
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Preview</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '5px 10px', borderRadius: 8 }}>{renderDateSample(prefs.dateFormat ?? '') || '—'}</span>
              </div>
              <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                Tokens: <b>YYYY</b>/<b>YY</b> year · <b>MMMM</b>/<b>MMM</b>/<b>MM</b>/<b>M</b> month · <b>DD</b>/<b>D</b> day. Other characters (- / space) are literal. Want only the year? Type <b>YY</b>.
              </p>
            </Field>

            <Field label="Time format">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['24h', '12h'] as const).map((tf) => (
                  <button key={tf} type="button" onClick={() => setPref('timeFormat', tf)} style={{
                    padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${prefs.timeFormat === tf ? '#2563eb' : '#e2e8f0'}`,
                    background: prefs.timeFormat === tf ? '#eff6ff' : '#fff',
                    color: prefs.timeFormat === tf ? '#2563eb' : '#64748b',
                  }}>{tf}</button>
                ))}
              </div>
            </Field>

            <div style={{ borderTop: '1px solid #eef2f7', paddingTop: 6 }}>
              {toggle('screeningOrder', 'Chronological Screening order', 'Order Screening forms: Date of Visit → Consent → Demographics → I/E → Eligibility → Vitals → PE → ECG → Labs → Progress Notes → Completion.')}
              {toggle('generalSections', 'General Sections', 'Add Medical History, Allergies, Social History, Adverse Events, Serious Adverse Events.')}
            </div>

            {/* Question 3 pending Image 2 — do not invent a question. */}
            <div
              aria-label="Question 3 pending (Image 2)"
              style={{
                margin: '4px 0',
                padding: '16px 18px',
                border: '2px dashed #f59e0b',
                borderRadius: 12,
                background: '#fffbeb',
              }}
            >
              <p style={{ fontSize: 11.5, fontWeight: 800, color: '#b45309', letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Question 3 pending (Image 2)
              </p>
              <p style={{ fontSize: 12.5, color: '#92400e', marginTop: 6, lineHeight: 1.5 }}>
                This Plan Mode question will be filled in once the screenshot arrives. Do not skip this slot.
              </p>
            </div>

            <YesNoDetail
              label="Field descriptions"
              hint="Write completion guidance on each field."
              on={!!prefs.fieldDescriptions}
              onToggle={(v) => setPref('fieldDescriptions', v)}
              detail={prefs.fieldDescriptionDetail ?? 'medium'}
              onDetail={(d) => setPref('fieldDescriptionDetail', d)}
            />
            <YesNoDetail
              label="Field footnotes"
              hint="Add a footnote under fields that have protocol/SOA notes."
              on={!!prefs.fieldFootnotes}
              onToggle={(v) => setPref('fieldFootnotes', v)}
              detail={prefs.fieldFootnoteDetail ?? 'medium'}
              onDetail={(d) => setPref('fieldFootnoteDetail', d)}
            />

            <Field label="Input-type badge under each input">
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>Display-only — does not change how the AI builds fields.</p>
              <YesNoChips value={!!prefs.showFieldTypeBadge} onChange={(v) => setPref('showFieldTypeBadge', v)} />
            </Field>

            <Field label="Custom instructions for the AI">
              <textarea
                value={prefs.instructions ?? ''}
                onChange={(e) => setPref('instructions', e.target.value)}
                rows={4}
                placeholder="e.g. Emphasize adverse-event and concomitant-medication logs. Add a pharmacokinetics sampling visit. Use plain language for site coordinators."
                style={{
                  ...inputStyle, resize: 'vertical', minHeight: 88, lineHeight: 1.5,
                }}
              />
              <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
                Added to the AI prompt to tailor the visits, forms, fields, and wording. Optional.
              </p>
            </Field>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div style={card}>
          <div style={{ padding: '20px 26px 22px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Universal Rules</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 14px', lineHeight: 1.5 }}>
              Select questions/rules to feed into the build prompt and set each Yes/No answer. The Universal Rules apply by default;
              set one to <b>No</b> to disable it for this build. Custom questions you add are saved and reappear next time.
              Groups start collapsed.
            </p>
            {qError && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 12 }}>
                <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ color: '#dc2626', fontSize: 13 }}>{qError}</p>
              </div>
            )}
            {questionGroups.map((grp) => {
              const selectedCount = grp.list.filter((q) => isSelected(q.id)).length;
              const open = openGroups.has(grp.name);
              return (
                <div key={grp.name} style={{ marginBottom: 10, border: '1px solid #eef2f7', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups((prev) => {
                      const next = new Set(prev);
                      if (next.has(grp.name)) next.delete(grp.name); else next.add(grp.name);
                      return next;
                    })}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', border: 'none', background: '#fafbff', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {open ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.3, textTransform: 'uppercase' }}>{grp.name}</p>
                    {grp.list.length > 0 && (
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{selectedCount}/{grp.list.length}</span>
                    )}
                    {grp.name !== 'Custom' && grp.list.length > 0 && (
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setGroupSelected(grp.list, true)} style={miniBtn}>Select all</button>
                        <button type="button" onClick={() => setGroupSelected(grp.list, false)} style={miniBtn}>Clear</button>
                      </div>
                    )}
                  </button>
                  {open && (
                    <div style={{ padding: '8px 10px 10px' }}>
                      {grp.name === 'Custom' && grp.list.length === 0 && (
                        <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', marginBottom: 6 }}>No custom questions yet — add one below.</p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 4 }}>
                        {grp.list.map((q) => (
                          <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', background: isSelected(q.id) ? '#eff6ff' : 'transparent', border: `1px solid ${isSelected(q.id) ? '#bfdbfe' : 'transparent'}` }}>
                            <input type="checkbox" checked={isSelected(q.id)} onChange={() => toggleQuestion(q)} style={{ accentColor: '#2563eb' }} />
                            <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{q.text}</span>
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
                  )}
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
              <button className="lift" type="button" onClick={addCustomQuestion} disabled={addingQ || !newQText.trim()} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 9, border: 'none',
                background: addingQ || !newQText.trim() ? '#cbd5e1' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: addingQ || !newQText.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
              }}>
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div style={card}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 35%, #f26a1b 100%)' }} />
          <div style={{ padding: '20px 26px 22px' }}>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 3 }}>Study Documents</p>
              <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
                The <strong style={{ color: '#475569' }}>Protocol</strong> drives the visit schedule (its Schedule of Activities table + footnotes).
                The <strong style={{ color: '#475569' }}>eCRF / Completion Guide</strong> supplies the exact forms and fields.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <DocumentUploadBox
                label="Protocol"
                required
                hint="Clinical study protocol containing the Schedule of Activities."
                files={protocolFiles}
                onFilesChange={onProtocolFilesChange}
                accent="#2563eb"
              />
              <DocumentUploadBox
                label="eCRF / Completion Guide"
                hint="eCRF or CRF completion requirements (recommended for full field detail)."
                files={ecrfFiles}
                onFilesChange={onEcrfFilesChange}
                accent="#f26a1b"
              />
            </div>

            <button type="button" onClick={onBuild} disabled={protocolFiles.length === 0} style={{
              width: '100%', marginTop: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 9, padding: '13px', borderRadius: 13, border: 'none',
              background: protocolFiles.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #fb8c3b 0%, #f26a1b 55%, #ea5e0b 100%)',
              color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.1,
              cursor: protocolFiles.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: protocolFiles.length === 0 ? 'none' : '0 10px 22px rgba(234,94,11,0.32), 0 1px 0 rgba(255,255,255,0.3) inset',
              transition: 'transform 0.12s ease, box-shadow 0.2s ease',
            }}>
              <Sparkles size={17} />
              Build Structured eSource{allFiles.length > 1 ? ` from ${allFiles.length} documents` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Back / Next — Next is a confirmation gate (defaults fill mandatory answers). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          disabled={wizardStep === 1}
          onClick={() => setWizardStep((s) => (s === 1 ? s : ((s - 1) as WizardStep)))}
          style={{
            padding: '10px 18px', borderRadius: 11, border: '1px solid #e2e8f0',
            background: '#fff', color: wizardStep === 1 ? '#cbd5e1' : '#334155',
            fontSize: 13.5, fontWeight: 700, cursor: wizardStep === 1 ? 'not-allowed' : 'pointer',
          }}
        >
          Back
        </button>
        {wizardStep < 3 && (
          <button
            type="button"
            disabled={wizardStep === 1 && !step1Ready}
            onClick={() => {
              if (wizardStep === 1 && !step1Ready) return;
              setWizardStep((s) => (s === 3 ? s : ((s + 1) as WizardStep)));
            }}
            style={{
              marginLeft: 'auto', padding: '10px 22px', borderRadius: 11, border: 'none',
              background: wizardStep === 1 && !step1Ready ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: wizardStep === 1 && !step1Ready ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 12,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>Error</p>
            <p style={{ color: '#ef4444', fontSize: 13, marginTop: 2 }}>{error}</p>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 640, marginInline: 'auto', lineHeight: 1.5 }}>
        Conceptual reference only. AI generation is real; study data may be representative. Every AI output is a
        draft a human approves — not certified or submission-ready.
      </p>
    </>
  );
}

const card: React.CSSProperties = {
  background: '#fff', borderRadius: 22, border: '1px solid #eaeef4',
  boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', overflow: 'hidden',
};
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

function YesNoChips({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as const).map((opt) => (
        <button key={opt.l} type="button" onClick={() => onChange(opt.v)} style={{
          padding: '8px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          border: `1.5px solid ${value === opt.v ? '#2563eb' : '#e2e8f0'}`,
          background: value === opt.v ? '#eff6ff' : '#fff',
          color: value === opt.v ? '#2563eb' : '#64748b',
        }}>{opt.l}</button>
      ))}
    </div>
  );
}

function YesNoDetail({ label, hint, on, onToggle, detail, onDetail }: {
  label: string; hint: string; on: boolean; onToggle: (v: boolean) => void;
  detail: DetailLevel; onDetail: (d: DetailLevel) => void;
}) {
  return (
    <Field label={label}>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{hint}</p>
      <YesNoChips value={on} onChange={onToggle} />
      {on && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {DETAIL_LEVELS.map((d) => (
            <button key={d} type="button" onClick={() => onDetail(d)} style={{
              padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              textTransform: 'capitalize',
              border: `1.5px solid ${detail === d ? '#2563eb' : '#e2e8f0'}`,
              background: detail === d ? '#eff6ff' : '#fff',
              color: detail === d ? '#2563eb' : '#64748b',
            }}>{d}</button>
          ))}
        </div>
      )}
    </Field>
  );
}
