import { useState } from 'react';
import { AlertCircle, Sparkles } from 'lucide-react';
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

const DATE_PRESETS = [
  ['DD-MMM-YYYY', '24-Aug-2026'], ['YYYY-MM-DD', '2026-08-24'], ['MM/DD/YYYY', '08/24/2026'], ['DD/MM/YYYY', '24/08/2026'],
  ['MMM YYYY', 'Aug 2026'], ['MMMM D, YYYY', 'August 24, 2026'], ['YYYY', '2026'], ['YY', '26'],
] as const;
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
    { label: 'Forms created', n: buildTree.reduce((t, r) => t + r.forms.length, 0), color: '#BE4A46' },
    { label: 'Patient visits', n: buildTree.filter((r) => r.kind !== 'log').length, color: '#2F6B4F' },
    { label: 'Fields generated', n: buildTree.reduce((t, r) => t + r.forms.reduce((x, f) => x + f.fieldCount, 0), 0), color: '#BE4A46' },
  ];

  const stepTitle = step === 1 ? 'Plan mode' : step === 2 ? 'Upload Protocol and eCRF' : 'Building your eSource';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="float-in">
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A857B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>New eSource</p>
        <h1 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', color: '#17181A' }}>{stepTitle}</h1>
      </div>

      {/* Numbered rail */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 26, paddingRight: 6 }}>
        {STEPS.map(({ n, label }, i) => {
          const active = step === n;
          const done = step > n;
          const allowed = canGoTo(n);
          const last = i === STEPS.length - 1;
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0, flex: last ? '0 0 auto' : '1 1 0%' }}>
              <button
                type="button"
                onClick={() => allowed && setWizardStep(n)}
                disabled={!allowed}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  width: 108, flexShrink: 0, background: 'none', border: 'none', padding: 0,
                  cursor: allowed ? 'pointer' : 'not-allowed',
                }}
              >
                <span style={{
                  width: 30, height: 30, borderRadius: '50%', boxSizing: 'border-box',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500,
                  background: active ? '#BE4A46' : done ? '#FDF1F1' : '#fff',
                  color: active ? '#fff' : done ? '#BE4A46' : '#A29C90',
                  border: `2px solid ${active ? '#BE4A46' : done ? '#F1CFCE' : '#E6E3DC'}`,
                }}>{done ? '✓' : n}</span>
                <span style={{
                  fontSize: 12.5, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap',
                  color: active ? '#17181A' : done ? '#6E6A62' : '#A29C90',
                }}>{label}</span>
              </button>
              {!last && (
                <div style={{ flex: 1, minWidth: 20, height: 2, marginTop: 14, background: done ? '#BE4A46' : '#E6E3DC' }} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginTop: 28 }}>
            <p style={{ fontSize: 13, color: '#6E6A62', maxWidth: 460, lineHeight: 1.5 }}>
              Five answers shape how every field is written. Defaults are already set — Next confirms them.
            </p>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12, whiteSpace: 'nowrap',
              color: step1Ready ? '#2F6B4F' : '#A29C90',
            }}>{answered} of {answers.length} answered</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <NumberedCard n="01" label="Date format" required>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
                {DATE_PRESETS.map(([f, sample]) => {
                  const on = prefs.dateFormat === f;
                  return (
                    <div key={f} onClick={() => setPref('dateFormat', f)} style={{
                      padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${on ? '#BE4A46' : '#E6E3DC'}`,
                      background: on ? '#FDF1F1' : '#fff',
                    }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: on ? '#BE4A46' : '#17181A' }}>{f}</div>
                      <div style={{ fontSize: 11.5, color: '#918B7F', marginTop: 3 }}>{sample}</div>
                    </div>
                  );
                })}
              </div>
              <input
                value={prefs.dateFormat ?? ''}
                onChange={(e) => setPref('dateFormat', e.target.value)}
                placeholder="Custom token, e.g. YYYY-MM-DD"
                style={{ ...inputStyle, marginTop: 10 }}
              />
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 9, background: '#FBFAF7', border: '1px solid #EFECE5' }}>
                <span style={{ fontSize: 12, color: '#918B7F' }}>Preview</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: '#17181A' }}>{renderDateSample(prefs.dateFormat ?? '') || '—'}</span>
              </div>
            </NumberedCard>

            <NumberedCard n="02" label="Time format" required>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 12, maxWidth: 300 }}>
                {([['24h', '24-hour · 14:30'], ['12h', '12-hour · 02:30 PM']] as const).map(([tf, sample]) => {
                  const on = prefs.timeFormat === tf;
                  return (
                    <div key={tf} onClick={() => setPref('timeFormat', tf)} style={{
                      padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
                      border: `1px solid ${on ? '#BE4A46' : '#E6E3DC'}`,
                      background: on ? '#FDF1F1' : '#fff',
                    }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 500, color: on ? '#BE4A46' : '#17181A' }}>{tf}</div>
                      <div style={{ fontSize: 11.5, color: '#918B7F', marginTop: 3 }}>{sample}</div>
                    </div>
                  );
                })}
              </div>
            </NumberedCard>

            <NumberedCard n="03" label="Descriptions against fields" required>
              <p style={{ fontSize: 12.5, color: '#8A857B', marginTop: 4 }}>Write completion guidance on each field.</p>
              <PillYesNo value={!!prefs.fieldDescriptions} onChange={(v) => setPref('fieldDescriptions', v)} />
              {prefs.fieldDescriptions && (
                <DetailRow value={prefs.fieldDescriptionDetail ?? 'medium'} onChange={(d) => setPref('fieldDescriptionDetail', d)} />
              )}
            </NumberedCard>

            <NumberedCard n="04" label="Footnotes against fields" required>
              <p style={{ fontSize: 12.5, color: '#8A857B', marginTop: 4 }}>Add a footnote under fields that have protocol/SOA notes.</p>
              <PillYesNo value={!!prefs.fieldFootnotes} onChange={(v) => setPref('fieldFootnotes', v)} />
              {prefs.fieldFootnotes && (
                <DetailRow value={prefs.fieldFootnoteDetail ?? 'medium'} onChange={(d) => setPref('fieldFootnoteDetail', d)} />
              )}
            </NumberedCard>

            <NumberedCard n="05" label="Input type badge under each input" required>
              <p style={{ fontSize: 12.5, color: '#8A857B', marginTop: 4 }}>Display-only — does not change how the AI builds fields.</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                <PillYesNo value={!!prefs.showFieldTypeBadge} onChange={(v) => setPref('showFieldTypeBadge', v)} noMargin />
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderRadius: 9, background: '#FBFAF7', border: '1px solid #EFECE5' }}>
                  <span style={{ fontSize: 12, color: '#918B7F' }}>Preview</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: '#F1EFEA', color: '#6E6A62' }}>Integer</span>
                </div>
              </div>
            </NumberedCard>

            <NumberedCard n="06" label="Custom instructions for the AI" optional>
              <textarea
                value={prefs.instructions ?? ''}
                onChange={(e) => setPref('instructions', e.target.value)}
                rows={3}
                placeholder="e.g. Emphasize adverse-event and concomitant-medication logs. Add a pharmacokinetics sampling visit. Use plain language for site coordinators."
                style={{ ...inputStyle, marginTop: 12, resize: 'vertical', minHeight: 76, lineHeight: 1.55 }}
              />
            </NumberedCard>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 28 }}>
          <p style={{ fontSize: 13, color: '#6E6A62', lineHeight: 1.5, maxWidth: 620 }}>
            The <strong style={{ color: '#17181A' }}>Protocol</strong> drives the visit schedule (its Schedule of Activities table + footnotes).
            The <strong style={{ color: '#17181A' }}>eCRF / Completion Guide</strong> supplies the exact forms and fields.
          </p>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 18 }}>
            <DocumentUploadBox
              label="Protocol"
              required
              hint="Clinical study protocol containing the Schedule of Activities."
              files={protocolFiles}
              onFilesChange={onProtocolFilesChange}
              accent="#BE4A46"
            />
            <DocumentUploadBox
              label="eCRF / Completion Guide"
              hint="eCRF or CRF completion requirements (recommended for full field detail)."
              files={ecrfFiles}
              onFilesChange={onEcrfFilesChange}
              accent="#17181A"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A29C90' }}>Building now</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#E0716D', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: '#17181A', marginTop: 8 }}>{stageMsg || 'Starting the build…'}</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 16 }}>
            {outputs.map((o) => (
              <div key={o.label} style={{ background: '#fff', border: '1px solid #E6E3DC', borderRadius: 12, padding: 16 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 19, fontWeight: 500, color: '#17181A' }}>{o.n.toLocaleString()}</p>
                <p style={{ fontSize: 12.5, color: '#6E6A62', marginTop: 4 }}>{o.label}</p>
                <div style={{ height: 4, borderRadius: 2, background: '#EDEAE2', overflow: 'hidden', marginTop: 12 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: o.color, width: `${progress}%`, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12.5, color: '#8A857B', marginTop: 12 }}>{progress}% complete</p>

          {buildTree.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {Array.from(new Set(buildTree.map((r) => r.arm))).map((arm) => (
                <div key={arm}>
                  <p style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#BE4A46', marginBottom: 6 }}>{arm}</p>
                  {buildTree.filter((r) => r.arm === arm).map((r, i) => (
                    <div key={`${r.folder}-${i}`} style={{ padding: '9px 12px', borderRadius: 10, background: '#fff', border: '1px solid #EFECE5', marginBottom: 6 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: '#17181A' }}>{r.folder}</p>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#918B7F', marginTop: 3 }}>
                        {r.forms.length} form{r.forms.length !== 1 ? 's' : ''} · {r.forms.reduce((x, f) => x + f.fieldCount, 0)} fields
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Back / Next — Next is a confirmation gate (defaults fill mandatory answers). */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 24 }}>
        <button
          type="button"
          disabled={step === 1 || building}
          onClick={() => setWizardStep((v) => (v === 1 ? v : ((v - 1) as WizardStep)))}
          style={{
            padding: '11px 18px', borderRadius: 10, border: '1px solid #DCD8CF',
            background: '#fff', color: step === 1 || building ? '#CBC5B8' : '#17181A',
            fontSize: 13.5, fontWeight: 500, cursor: step === 1 || building ? 'not-allowed' : 'pointer',
          }}
        >
          Back
        </button>
        {step === 1 && (
          <button
            type="button"
            disabled={!step1Ready}
            onClick={() => { if (step1Ready) setWizardStep(2); }}
            style={{
              padding: '11px 26px', borderRadius: 10, border: 'none',
              background: step1Ready ? '#BE4A46' : '#C6BFB2',
              color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: step1Ready ? 'pointer' : 'not-allowed',
            }}
          >
            Next
          </button>
        )}
        {step === 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 12.5, color: '#8A857B' }}>Protocol required. eCRF recommended for full field detail.</span>
            <button type="button" onClick={onBuild} disabled={protocolFiles.length === 0} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: 'none',
              background: protocolFiles.length === 0 ? '#C6BFB2' : '#BE4A46',
              color: '#fff', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap',
              cursor: protocolFiles.length === 0 ? 'not-allowed' : 'pointer',
            }}>
              <Sparkles size={15} />
              Create eSource{allFiles.length > 1 ? ` from ${allFiles.length} docs` : ''}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 12,
          background: '#FBEDEB', border: '1px solid #F1CFCE',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertCircle size={18} color="#A02D24" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 600, color: '#A02D24', fontSize: 14 }}>Error</p>
            <p style={{ color: '#A02D24', fontSize: 13, marginTop: 2 }}>{error}</p>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', fontSize: 11.5, color: '#A29C90', marginTop: 20, lineHeight: 1.5 }}>
        Conceptual reference only. AI generation is real; study data may be representative. Every AI output is a
        draft a human approves — not certified or submission-ready.
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9, border: '1px solid #DCD8CF',
  fontSize: 13.5, color: '#17181A', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
};

function NumberedCard({ n, label, required, optional, children }: {
  n: string; label: string; required?: boolean; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E6E3DC', borderRadius: 14, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: '#A29C90' }}>{n}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: '#17181A' }}>{label}</span>
        {required && <span style={{ color: '#A02D24', fontSize: 13 }}>*</span>}
        {optional && (
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 5, background: '#F1EFEA', color: '#8A857B' }}>
            Optional
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function PillYesNo({ value, onChange, noMargin }: { value: boolean; onChange: (v: boolean) => void; noMargin?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: noMargin ? 0 : 12 }}>
      {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }] as const).map((opt) => {
        const on = value === opt.v;
        return (
          <div key={opt.l} onClick={() => onChange(opt.v)} style={{
            padding: '9px 22px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: `1px solid ${on ? '#BE4A46' : '#E6E3DC'}`,
            background: on ? '#FDF1F1' : '#fff',
            color: on ? '#BE4A46' : '#17181A',
          }}>{opt.l}</div>
        );
      })}
    </div>
  );
}

function DetailRow({ value, onChange }: { value: DetailLevel; onChange: (d: DetailLevel) => void }) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0EDE6' }}>
      <p style={{ fontSize: 12.5, color: '#6E6A62' }}>How detailed?</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {DETAIL_LEVELS.map((d) => {
          const on = value === d;
          return (
            <div key={d} onClick={() => onChange(d)} style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
              textTransform: 'capitalize',
              border: `1px solid ${on ? '#BE4A46' : '#E6E3DC'}`,
              background: on ? '#FDF1F1' : '#fff',
              color: on ? '#BE4A46' : '#17181A',
            }}>{d}</div>
          );
        })}
      </div>
    </div>
  );
}
