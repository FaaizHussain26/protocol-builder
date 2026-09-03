// Phase 3: real interactive data entry against a saved study's build —
// subjects → visit instances → form submissions, with autosave and a
// submit/sign lifecycle. Sits alongside the build/preview tabs in
// StudyBuilder; unlike FieldInput in study/components.tsx (a disconnected
// preview of the field's TYPE), everything here is a controlled input bound
// to a real FormSubmission record's values.
import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Check, PenLine, Upload, X, Lock, Users,
} from 'lucide-react';
import type { StudyModel, StudyField, StudyForm, StudyVisit, Subject, VisitInstance, FormSubmission, SubmissionRecord } from '../types/study';
import {
  listSubjects, createSubject, getSubject, createVisitInstance,
  getFormSubmission, addRecord, deleteRecord, updateRecordValues, submitRecord, signRecord,
} from '../utils/api';
import { useAuth } from '../utils/auth';

const AUTOSAVE_DEBOUNCE_MS = 700;

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
}

// ---- Controlled field input, bound to a record's values ----
function DataEntryField({ field, value, onChange, disabled }: {
  field: StudyField; value: unknown; onChange: (v: unknown) => void; disabled: boolean;
}) {
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
  const str = typeof value === 'string' ? value : '';

  switch (field.type) {
    case 'textarea':
      return <textarea rows={2} disabled={disabled} value={str} onChange={e => onChange(e.target.value)}
        placeholder="Enter response" style={{ ...base, resize: 'vertical', minHeight: 56, lineHeight: 1.5 }} />;
    case 'number':
    case 'integer':
      return <input type="number" step={field.type === 'integer' ? 1 : 'any'} disabled={disabled}
        value={str} onChange={e => onChange(e.target.value)} placeholder="0" style={base} />;
    case 'decimal':
      return <input type="number" step="any" disabled={disabled} value={str} onChange={e => onChange(e.target.value)} placeholder="0.0" style={base} />;
    case 'date':
      return <input type="date" disabled={disabled} value={str} onChange={e => onChange(e.target.value)} style={base} />;
    case 'datetime':
      return <input type="datetime-local" disabled={disabled} value={str} onChange={e => onChange(e.target.value)} style={base} />;
    case 'time':
      return <input type="time" disabled={disabled} value={str} onChange={e => onChange(e.target.value)} style={base} />;
    case 'select':
      return (
        <select disabled={disabled} value={str} onChange={e => onChange(e.target.value)} style={base}>
          <option value="" disabled>Select…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="N/A">N/A</option>
        </select>
      );
    case 'multiselect':
    case 'checkbox': {
      const arr = Array.isArray(value) ? value as string[] : [];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="checkbox" disabled={disabled} checked={arr.includes(o)} style={{ accentColor: '#BE4A46' }}
                onChange={e => onChange(e.target.checked ? [...arr, o] : arr.filter(x => x !== o))} /> {o}
            </label>
          )) : <span style={{ fontSize: 12, color: '#8A857B', fontStyle: 'italic' }}>No options defined.</span>}
        </div>
      );
    }
    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opts.length ? opts.map(o => (
            <label key={o} style={choice}>
              <input type="radio" name={field.id} disabled={disabled} checked={str === o} style={{ accentColor: '#BE4A46' }}
                onChange={() => onChange(o)} /> {o}
            </label>
          )) : <span style={{ fontSize: 12, color: '#8A857B', fontStyle: 'italic' }}>No options defined.</span>}
        </div>
      );
    case 'yesno':
      return (
        <select disabled={disabled} value={str} onChange={e => onChange(e.target.value)} style={base}>
          <option value="" disabled>Select…</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    case 'signature':
      return <SignaturePad value={str} onChange={onChange} disabled={disabled} />;
    case 'file': {
      const file = value && typeof value === 'object' ? value as { name: string; dataUrl: string } : null;
      return (
        <div>
          {file ? (
            <div style={{ ...base, display: 'flex', alignItems: 'center', gap: 8, color: '#5C584F' }}>
              <Upload size={15} /> <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              {!disabled && <button onClick={() => onChange(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#8A857B' }}><X size={14} /></button>}
            </div>
          ) : (
            <label style={{
              ...base, borderStyle: 'dashed', display: 'flex', alignItems: 'center', gap: 8, color: '#6E6A62',
              cursor: disabled ? 'default' : 'pointer',
            }}>
              <Upload size={15} /> <span style={{ fontSize: 13 }}>Upload file</span>
              <input type="file" disabled={disabled} style={{ display: 'none' }} onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => onChange({ name: f.name, dataUrl: String(reader.result) });
                reader.readAsDataURL(f);
              }} />
            </label>
          )}
        </div>
      );
    }
    case 'calculated':
      return <input type="text" readOnly disabled placeholder={field.expression ? `= ${field.expression}` : 'Calculated value'}
        style={{ ...base, background: '#FBFAF7', color: '#6E6A62', fontStyle: 'italic' }} />;
    case 'text':
    default:
      return <input type="text" disabled={disabled} value={str} onChange={e => onChange(e.target.value)} placeholder="Enter response" style={base} />;
  }
}

function SignaturePad({ value, onChange, disabled }: { value: string; onChange: (v: string | null) => void; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    }
  }, [value]);

  if (value && disabled) {
    return <img src={value} alt="Signature" style={{ height: 56, border: '1.5px solid #DCD8CF', borderRadius: 9, background: '#fff' }} />;
  }

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div>
      <canvas
        ref={canvasRef} width={280} height={80} style={{
          width: '100%', height: 80, borderRadius: 9, border: '1.5px dashed #DCD8CF', background: '#fff',
          touchAction: 'none', cursor: disabled ? 'default' : 'crosshair',
        }}
        onPointerDown={e => {
          if (disabled) return;
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d');
          const { x, y } = pos(e);
          ctx?.beginPath();
          ctx?.moveTo(x, y);
        }}
        onPointerMove={e => {
          if (disabled || !drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#17181A';
          ctx.lineTo(x, y); ctx.stroke();
        }}
        onPointerUp={e => {
          if (disabled) return;
          drawing.current = false;
          onChange(e.currentTarget.toDataURL('image/png'));
        }}
      />
      {!disabled && (
        <button onClick={() => onChange(null)} style={{
          marginTop: 6, border: 'none', background: 'none', color: '#8A857B', fontSize: 11.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}><PenLine size={12} /> Clear</button>
      )}
    </div>
  );
}

// ---- Main data-entry screen ----
export default function DataEntry({ study, studyId }: { study: StudyModel; studyId?: string }) {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(() => !!studyId);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [visitInstances, setVisitInstances] = useState<VisitInstance[]>([]);
  const [selectedVisitInstance, setSelectedVisitInstance] = useState<VisitInstance | null>(null);
  const [selectedForm, setSelectedForm] = useState<StudyForm | null>(null);
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');

  useEffect(() => {
    if (!studyId) return;
    listSubjects(studyId).then(setSubjects).catch(e => setError(e.message)).finally(() => setSubjectsLoading(false));
  }, [studyId]);

  const openSubject = async (s: Subject) => {
    setError(null);
    setSelectedSubject(s);
    setSelectedVisitInstance(null);
    setSelectedForm(null);
    setSubmission(null);
    try {
      const full = await getSubject(s.id);
      setVisitInstances(full.visits ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subject.');
    }
  };

  const handleCreateSubject = async () => {
    if (!studyId || !newCode.trim()) return;
    setError(null);
    try {
      const s = await createSubject(studyId, newCode.trim());
      setNewCode('');
      setSubjects(prev => [...prev, s]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create subject.');
    }
  };

  const openVisit = async (visitDef: StudyVisit) => {
    if (!selectedSubject) return;
    setError(null);
    setSelectedForm(null);
    setSubmission(null);
    let instance = visitInstances.find(v => v.visitId === visitDef.id) ?? null;
    try {
      if (!instance) {
        instance = await createVisitInstance(selectedSubject.id, visitDef.id);
        setVisitInstances(prev => [...prev, instance!]);
      }
      setSelectedVisitInstance(instance);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open visit.');
    }
  };

  const openForm = async (form: StudyForm) => {
    if (!selectedVisitInstance) return;
    setError(null);
    setSelectedForm(form);
    try {
      const sub = await getFormSubmission(selectedVisitInstance.id, form.id);
      setSubmission(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open form.');
    }
  };

  const refreshVisits = async () => {
    if (!selectedSubject) return;
    const full = await getSubject(selectedSubject.id);
    setVisitInstances(full.visits ?? []);
  };

  if (!studyId) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#8A857B', fontSize: 13.5 }}>
        Save this eSource before entering data — subjects and submissions are attached to a saved study.
      </div>
    );
  }

  // ---- Breadcrumb ----
  const crumbs: { label: string; onClick?: () => void }[] = [
    { label: 'Subjects', onClick: () => { setSelectedSubject(null); setSelectedVisitInstance(null); setSelectedForm(null); setSubmission(null); } },
  ];
  if (selectedSubject) crumbs.push({ label: selectedSubject.subjectCode, onClick: () => { setSelectedVisitInstance(null); setSelectedForm(null); setSubmission(null); } });
  if (selectedVisitInstance) crumbs.push({ label: selectedVisitInstance.visitName, onClick: () => { setSelectedForm(null); setSubmission(null); } });
  if (selectedForm) crumbs.push({ label: selectedForm.name });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontSize: 12.5, color: '#8A857B' }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <ChevronRight size={12} />}
            {c.onClick ? (
              <button onClick={c.onClick} style={{ border: 'none', background: 'none', color: i === crumbs.length - 1 ? '#17181A' : '#BE4A46', fontWeight: i === crumbs.length - 1 ? 600 : 500, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>
                {c.label}
              </button>
            ) : <span style={{ color: '#17181A', fontWeight: 600 }}>{c.label}</span>}
          </span>
        ))}
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 9, background: '#FBEDEB', color: '#973C38', fontSize: 12.5 }}>{error}</div>
      )}

      {!selectedSubject && (
        <SubjectList
          subjects={subjects} loading={subjectsLoading} newCode={newCode}
          onNewCode={setNewCode} onCreate={handleCreateSubject} onOpen={openSubject}
        />
      )}

      {selectedSubject && !selectedVisitInstance && (
        <VisitList study={study} visitInstances={visitInstances} onOpen={openVisit} />
      )}

      {selectedVisitInstance && !selectedForm && (
        <FormList
          visitInstance={selectedVisitInstance}
          forms={study.visits.find(v => v.id === selectedVisitInstance.visitId)?.forms ?? []}
          onOpen={openForm}
        />
      )}

      {selectedForm && submission && (
        <FormFillScreen
          form={selectedForm} submission={submission} onSubmissionChange={setSubmission}
          userRole={user?.role} onBack={() => { setSelectedForm(null); setSubmission(null); void refreshVisits(); }}
        />
      )}
    </div>
  );
}

function SubjectList({ subjects, loading, newCode, onNewCode, onCreate, onOpen }: {
  subjects: Subject[]; loading: boolean; newCode: string; onNewCode: (v: string) => void;
  onCreate: () => void; onOpen: (s: Subject) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={newCode} onChange={e => onNewCode(e.target.value)} placeholder="Subject code (e.g. 101-003)"
          onKeyDown={e => e.key === 'Enter' && onCreate()}
          style={{ flex: 1, maxWidth: 280, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #DCD8CF', fontSize: 13.5, outline: 'none' }} />
        <button onClick={onCreate} disabled={!newCode.trim()} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', borderRadius: 9, border: 'none',
          background: newCode.trim() ? '#BE4A46' : '#E6E3DC', color: '#fff', fontWeight: 600, fontSize: 13, cursor: newCode.trim() ? 'pointer' : 'default',
        }}><Plus size={14} /> Add subject</button>
      </div>

      {loading ? (
        <p style={{ color: '#8A857B', fontSize: 13 }}>Loading subjects…</p>
      ) : subjects.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8A857B', fontSize: 13 }}>
          <Users size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No subjects yet. Add one to start entering data.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {subjects.map(s => (
            <button key={s.id} onClick={() => onOpen(s)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
              padding: '12px 14px', borderRadius: 10, border: '1px solid #E6E3DC', background: '#fff', cursor: 'pointer',
            }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: '#17181A' }}>{s.subjectCode}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <StatusPill status={s.status} />
                <ChevronRight size={14} color="#8A857B" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VisitList({ study, visitInstances, onOpen }: { study: StudyModel; visitInstances: VisitInstance[]; onOpen: (v: StudyVisit) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {study.visits.map(v => {
        const instance = visitInstances.find(i => i.visitId === v.id);
        return (
          <button key={v.id} onClick={() => onOpen(v)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
            padding: '12px 14px', borderRadius: 10, border: '1px solid #E6E3DC', background: '#fff', cursor: 'pointer',
          }}>
            <span>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: '#17181A' }}>{v.name}</span>
              <span style={{ marginLeft: 8, fontSize: 11.5, color: '#8A857B' }}>{v.forms.length} form{v.forms.length !== 1 ? 's' : ''}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {instance ? <StatusPill status={instance.status} /> : <span style={{ fontSize: 11.5, color: '#8A857B', fontStyle: 'italic' }}>Not started</span>}
              <ChevronRight size={14} color="#8A857B" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FormList({ forms, onOpen }: { visitInstance: VisitInstance; forms: StudyForm[]; onOpen: (f: StudyForm) => void }) {
  if (forms.length === 0) return <p style={{ color: '#8A857B', fontSize: 13 }}>This visit has no forms.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {forms.map(f => (
        <button key={f.id} onClick={() => onOpen(f)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left',
          padding: '12px 14px', borderRadius: 10, border: '1px solid #E6E3DC', background: '#fff', cursor: 'pointer',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, color: '#17181A' }}>{f.name}{f.repeatable ? ' (repeatable)' : ''}</span>
          <ChevronRight size={14} color="#8A857B" />
        </button>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    'enrolled': { bg: '#EAF2ED', fg: '#2F6B4F' }, 'completed': { bg: '#EAF2ED', fg: '#2F6B4F' },
    'screen-failed': { bg: '#FBEDEB', fg: '#973C38' }, 'withdrawn': { bg: '#FBEDEB', fg: '#973C38' },
    'scheduled': { bg: '#F5EFD6', fg: '#6B4E28' }, 'missed': { bg: '#FBEDEB', fg: '#973C38' },
    'in-progress': { bg: '#F5EFD6', fg: '#6B4E28' }, 'submitted': { bg: '#E9EEF9', fg: '#33538F' }, 'signed': { bg: '#EAF2ED', fg: '#2F6B4F' },
  };
  const s = styles[status] ?? { bg: '#F1EFEA', fg: '#5C584F' };
  return <span style={{ padding: '2px 9px', borderRadius: 20, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function FormFillScreen({ form, submission, onSubmissionChange, userRole, onBack }: {
  form: StudyForm; submission: FormSubmission; onSubmissionChange: (s: FormSubmission) => void;
  userRole?: string; onBack: () => void;
}) {
  const canSign = userRole === 'site' || userRole === 'builder' || userRole === 'admin';
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const scheduleAutosave = (recordId: string, values: Record<string, unknown>) => {
    clearTimeout(timers.current[recordId]);
    timers.current[recordId] = setTimeout(async () => {
      try {
        const updated = await updateRecordValues(submission.id, recordId, values);
        onSubmissionChange(updated);
      } catch { /* transient save failure — user's edits remain in the UI, will retry on next change */ }
    }, AUTOSAVE_DEBOUNCE_MS);
  };

  const setFieldValue = (recordId: string, fieldId: string, value: unknown) => {
    const next: FormSubmission = {
      ...submission,
      records: submission.records.map(r => r.id === recordId ? { ...r, values: { ...r.values, [fieldId]: value } } : r),
    };
    onSubmissionChange(next);
    scheduleAutosave(recordId, { [fieldId]: value });
  };

  const missingRequired = (rec: SubmissionRecord): string[] =>
    form.fields.filter(f => f.required && !hasValue(rec.values?.[f.id])).map(f => f.label);

  const doSubmit = async (recordId: string) => {
    const rec = submission.records.find(r => r.id === recordId);
    if (!rec) return;
    const missing = missingRequired(rec);
    if (missing.length) { setValidationError(`Required before submitting: ${missing.join(', ')}`); return; }
    setValidationError(null);
    setBusy(true);
    try { onSubmissionChange(await submitRecord(submission.id, recordId)); } catch (e) { setValidationError(e instanceof Error ? e.message : 'Submit failed.'); } finally { setBusy(false); }
  };

  const doSign = async (recordId: string) => {
    setBusy(true);
    try { onSubmissionChange(await signRecord(submission.id, recordId)); } catch (e) { setValidationError(e instanceof Error ? e.message : 'Sign failed.'); } finally { setBusy(false); }
  };

  const doAddRecord = async () => {
    setBusy(true);
    try { onSubmissionChange(await addRecord(submission.id)); } catch (e) { setValidationError(e instanceof Error ? e.message : 'Failed to add record.'); } finally { setBusy(false); }
  };

  const doDeleteRecord = async (recordId: string) => {
    if (!window.confirm('Delete this record?')) return;
    setBusy(true);
    try { onSubmissionChange(await deleteRecord(submission.id, recordId)); } catch (e) { setValidationError(e instanceof Error ? e.message : 'Failed to delete record.'); } finally { setBusy(false); }
  };

  const sections = groupBySection(form.fields);

  return (
    <div>
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', color: '#8A857B', fontSize: 12.5, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
        <ChevronLeft size={14} /> Back to forms
      </button>

      {validationError && (
        <div style={{ marginBottom: 14, padding: '9px 14px', borderRadius: 9, background: '#FBEDEB', color: '#973C38', fontSize: 12.5 }}>{validationError}</div>
      )}

      {form.repeatable && (
        <button onClick={doAddRecord} disabled={busy} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #F1CFCE',
          background: '#FDF1F1', color: '#BE4A46', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', marginBottom: 14,
        }}><Plus size={14} /> Add record</button>
      )}

      {submission.records.length === 0 && (
        <p style={{ color: '#8A857B', fontSize: 13 }}>No records yet.{form.repeatable ? ' Add one to begin.' : ''}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {submission.records.map((rec, idx) => {
          const locked = rec.status === 'signed';
          const readOnly = rec.status !== 'in-progress';
          return (
            <div key={rec.id} style={{ border: '1px solid #E6E3DC', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#FBFAF7', borderBottom: '1px solid #E6E3DC' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5C584F' }}>
                  {form.repeatable ? `Record ${idx + 1}` : 'Response'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StatusPill status={rec.status} />
                  {form.repeatable && rec.status === 'in-progress' && (
                    <button onClick={() => doDeleteRecord(rec.id)} style={{ border: 'none', background: 'none', color: '#8A857B', cursor: 'pointer' }}><X size={14} /></button>
                  )}
                </div>
              </div>

              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {sections.map(([section, fields]) => (
                  <div key={section}>
                    {section && <p style={{ fontSize: 11, fontWeight: 700, color: '#8A857B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{section}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {fields.map(f => (
                        <div key={f.id}>
                          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#17181A', marginBottom: 5 }}>
                            {f.label}{f.required && <span style={{ color: '#BE4A46' }}> *</span>}
                          </label>
                          {f.completionGuidance && <p style={{ fontSize: 11.5, color: '#8A857B', marginBottom: 5 }}>{f.completionGuidance}</p>}
                          <DataEntryField field={f} value={rec.values?.[f.id]} disabled={readOnly} onChange={v => setFieldValue(rec.id, f.id, v)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: '1px solid #E6E3DC', background: '#FBFAF7' }}>
                {rec.status === 'in-progress' && (
                  <button onClick={() => doSubmit(rec.id)} disabled={busy} style={btnPrimary}><Check size={14} /> Submit</button>
                )}
                {rec.status === 'submitted' && canSign && (
                  <button onClick={() => doSign(rec.id)} disabled={busy} style={btnPrimary}><PenLine size={14} /> Sign</button>
                )}
                {locked && <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8A857B' }}><Lock size={12} /> Locked — signed record</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#8A857B' }}>
                  {rec.submittedBy && `Submitted by ${rec.submittedBy.name} · ${fmtDate(rec.submittedAt)}`}
                  {rec.signedBy && ` · Signed by ${rec.signedBy.name} · ${fmtDate(rec.signedAt)}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none',
  background: '#BE4A46', color: '#fff', fontWeight: 600, fontSize: 12.5, cursor: 'pointer',
};

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function groupBySection(fields: StudyField[]): [string, StudyField[]][] {
  const map = new Map<string, StudyField[]>();
  for (const f of fields) {
    const key = f.section ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return Array.from(map.entries());
}
