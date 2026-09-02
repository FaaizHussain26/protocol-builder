import { useState } from 'react';
import {
  AlertCircle, AlertTriangle, CheckCircle2, FileOutput, FileText,
  Layers, Sparkles,
} from 'lucide-react';
import DocumentUploadBox from './DocumentUploadBox';
import { renderDateSample } from '../utils/formatPrefs';
import type { TemplatePreferences } from '../types/study';
import type { BuildTreeRow } from '../utils/api';

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
  /** True while the build job runs — pins the wizard on step 3. */
  building?: boolean;
  /** Live phase text, percent and arm→folder tree streamed from the server. */
  stageMsg?: string;
  progress?: number;
  buildTree?: BuildTreeRow[];
}

const DATE_PRESETS = ['DD-MMM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MMM YYYY', 'MMMM D, YYYY', 'YYYY', 'YY'];
const DETAIL_LEVELS = ['high', 'medium', 'low'] as const;
type DetailLevel = (typeof DETAIL_LEVELS)[number];

const STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: 'Plan mode' },
  { n: 2, label: 'Upload documents' },
  { n: 3, label: 'eSource' },
];

export default function NewBuildWizard({
  prefs, onPrefsChange,
  protocolFiles, onProtocolFilesChange,
  ecrfFiles, onEcrfFilesChange,
  onBuild, error,
  building = false, stageMsg = '', progress = 0, buildTree = [],
}: NewBuildWizardProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  // While the build runs the wizard is pinned to step 3 — the build IS step 3.
  const step: WizardStep = building ? 3 : wizardStep;

  const setPref = <K extends keyof TemplatePreferences>(key: K, value: TemplatePreferences[K]) =>
    onPrefsChange({ ...prefs, [key]: value });

  // The five mandatory Plan Mode answers. Each ships with a default, so the counter
  // normally reads 5 of 5 and Next simply confirms them; it only blocks if the user
  // clears one (e.g. empties the date format).
  const answers = [
    !!prefs.dateFormat?.trim(),
    prefs.timeFormat === '12h' || prefs.timeFormat === '24h',
    typeof prefs.fieldDescriptions === 'boolean',
    typeof prefs.fieldFootnotes === 'boolean',
    typeof prefs.showFieldTypeBadge === 'boolean',
  ];
  const answered = answers.filter(Boolean).length;
  const step1Ready = answered === answers.length;
  // Step 3 is entered by starting the build, never by clicking the rail; while the
  // build runs the wizard is pinned there, so nothing is navigable.
  const canGoTo = (n: WizardStep) => !building && n !== 3 && (n <= step || step1Ready);

  const allFiles = [...protocolFiles, ...ecrfFiles];

  // Step 3's three counters, derived from the tree the server streams as it builds.
  const outputs = [
    { label: 'Forms created', n: buildTree.reduce((t, r) => t + r.forms.length, 0), color: '#f26a1b' },
    { label: 'Patient visits', n: buildTree.filter((r) => r.kind !== 'log').length, color: '#16a34a' },
    { label: 'Fields generated', n: buildTree.reduce((t, r) => t + r.forms.reduce((x, f) => x + f.fieldCount, 0), 0), color: '#2563eb' },
  ];

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
          const active = step === n;
          const done = step > n;
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

      {step === 1 && (
        <div style={card}>
          <div style={{ padding: '20px 26px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Plan mode</p>
                  <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.5, maxWidth: 460 }}>
                    Five answers shape how every field is written. Defaults are already set — Next confirms them.
                  </p>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  color: step1Ready ? '#15803d' : '#94a3b8',
                }}>{answered} of {answers.length} answered</span>
              </div>
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

      {step === 2 && (
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

      {step === 3 && (
        <div style={card}>
          <div style={{ height: 4, background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 35%, #f26a1b 100%)' }} />
          <div style={{ padding: '20px 26px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#94a3b8' }}>Building now</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f26a1b', animation: 'pulse 1.4s ease-in-out infinite' }} />
            </div>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: '#1e293b', marginTop: 8 }}>{stageMsg || 'Starting the build…'}</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
              {outputs.map((o) => (
                <div key={o.label} style={{ background: '#fff', border: '1px solid #e8edf4', borderRadius: 12, padding: 16 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#0b1220', letterSpacing: -0.4 }}>{o.n.toLocaleString()}</p>
                  <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{o.label}</p>
                  <div style={{ height: 4, borderRadius: 2, background: '#eef2f7', overflow: 'hidden', marginTop: 12 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: o.color, width: `${progress}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 12 }}>{progress}% complete</p>

            {buildTree.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                {Array.from(new Set(buildTree.map((r) => r.arm))).map((arm) => (
                  <div key={arm}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: '#7c3aed', marginBottom: 6 }}>{arm}</p>
                    {buildTree.filter((r) => r.arm === arm).map((r, i) => (
                      <div key={`${r.folder}-${i}`} style={{ padding: '7px 10px', borderRadius: 9, background: '#fafbfc', border: '1px solid #eef2f7', marginBottom: 6 }}>
                        <p style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{r.folder}</p>
                        <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>
                          {r.forms.length} form{r.forms.length !== 1 ? 's' : ''} · {r.forms.reduce((x, f) => x + f.fieldCount, 0)} fields
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Back / Next — Next is a confirmation gate (defaults fill mandatory answers). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button
          type="button"
          disabled={step === 1 || building}
          onClick={() => setWizardStep((v) => (v === 1 ? v : ((v - 1) as WizardStep)))}
          style={{
            padding: '10px 18px', borderRadius: 11, border: '1px solid #e2e8f0',
            background: '#fff', color: step === 1 || building ? '#cbd5e1' : '#334155',
            fontSize: 13.5, fontWeight: 700, cursor: step === 1 || building ? 'not-allowed' : 'pointer',
          }}
        >
          Back
        </button>
        {step === 1 && (
          <button
            type="button"
            disabled={!step1Ready}
            onClick={() => {
              if (!step1Ready) return;
              setWizardStep(2);
            }}
            style={{
              marginLeft: 'auto', padding: '10px 22px', borderRadius: 11, border: 'none',
              background: !step1Ready ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#fff', fontSize: 13.5, fontWeight: 700,
              cursor: !step1Ready ? 'not-allowed' : 'pointer',
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
