import { useRef, useState } from 'react';
import { Check, X, FileUp, Loader, Sparkles, RotateCcw } from 'lucide-react';
import type { EsourceAnalysis, ReviewStatus, Template, TemplatePreferences } from '../types/study';
import { DEFAULT_PREFERENCES } from '../types/study';
import { analyzeEsource } from '../utils/api';
import { extractTextFromFile } from '../utils/extractText';
import { ConfidenceBadge, TypeBadge, Pill } from './ui';

// Upload an existing eSource → AI detects the site's preferences, universal-rule
// overrides, and the fields it would generate. The user approves/rejects each
// detected item (or everything at once) and turns the result into a template.

interface EsourceImportProps {
  /** Called with the drafted template built from the approved items. */
  onUseTemplate: (t: Template) => void;
}

type Phase = 'idle' | 'extracting' | 'analyzing' | 'review';

export default function EsourceImport({ onUseTemplate }: EsourceImportProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EsourceAnalysis | null>(null);
  // Review decision per detected item, keyed by item key. Missing = pending.
  const [review, setReview] = useState<Record<string, ReviewStatus>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => { setPhase('idle'); setAnalysis(null); setReview({}); setError(null); setFileName(''); };

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      setPhase('extracting');
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error('No text could be extracted from this file.');
      setPhase('analyzing');
      const result = await analyzeEsource(text, file.name);
      setAnalysis(result);
      setReview({});
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
      setPhase('idle');
    }
  };

  // ---- Review item keys ----
  const prefItems = analysis ? detectedPrefItems(analysis.preferences) : [];
  const qKeys = (analysis?.questions ?? []).map((_, i) => `q:${i}`);
  const rKeys = (analysis?.ruleOverrides ?? []).map((o) => `r:${o.id}`);
  const fKeys = (analysis?.forms ?? []).flatMap((f, fi) => f.fields.map((_, xi) => `f:${fi}:${xi}`));
  const allKeys = [...prefItems.map((p) => p.key), ...qKeys, ...rKeys, ...fKeys];

  const statusOf = (key: string): ReviewStatus => review[key] ?? 'pending';
  const setStatus = (key: string, status: ReviewStatus) =>
    setReview((r) => ({ ...r, [key]: r[key] === status ? 'pending' : status }));
  const setAll = (status: ReviewStatus) =>
    setReview(Object.fromEntries(allKeys.map((k) => [k, status])));

  const acceptedCount = allKeys.filter((k) => statusOf(k) === 'accepted').length;

  // ---- Turn the approved items into a template draft ----
  const buildTemplate = (): Template => {
    if (!analysis) throw new Error('no analysis');
    const prefs: TemplatePreferences = { ...DEFAULT_PREFERENCES };
    for (const p of prefItems) {
      if (statusOf(p.key) === 'accepted') (prefs as unknown as Record<string, unknown>)[p.prefKey] = p.value;
    }

    const questions = [
      ...analysis.questions.filter((_, i) => statusOf(`q:${i}`) === 'accepted'),
      // Approved universal-rule overrides become "No"-answered universal questions.
      ...analysis.ruleOverrides
        .filter((o) => statusOf(`r:${o.id}`) === 'accepted')
        .map((o) => ({
          id: o.id, text: o.text, answerType: 'yesno' as const,
          group: 'Universal rules (from eSource)', answer: 'no' as const, confidence: o.confidence,
        })),
    ];
    prefs.questions = questions;

    // Approved field previews become explicit build directives.
    const fieldLines: string[] = [];
    analysis.forms.forEach((form, fi) => {
      const kept = form.fields.filter((_, xi) => statusOf(`f:${fi}:${xi}`) === 'accepted');
      if (!kept.length) return;
      fieldLines.push(`Form "${form.name}": ` + kept.map((f) =>
        `${f.label} (${f.type}${f.required ? ', required' : ''}${f.options?.length ? `; options: ${f.options.join(', ')}` : ''})`,
      ).join('; '));
    });
    const instructions = [
      analysis.instructions?.trim(),
      fieldLines.length
        ? 'The site\'s existing eSource defines these forms and fields — generate them to match exactly:\n' + fieldLines.join('\n')
        : '',
    ].filter(Boolean).join('\n\n');
    if (instructions) prefs.instructions = instructions;

    return {
      name: analysis.templateName || fileName.replace(/\.[^.]+$/, '') || 'Imported eSource template',
      description: analysis.summary || `Imported from ${fileName}`,
      preferences: prefs,
    };
  };

  // ---------- idle / loading ----------
  if (phase !== 'review' || !analysis) {
    const busy = phase === 'extracting' || phase === 'analyzing';
    return (
      <div style={{ marginBottom: 12 }}>
        <input
          ref={inputRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ''; }}
        />
        <button
          className="lift" disabled={busy} onClick={() => inputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
            padding: '12px 14px', borderRadius: 10, border: '1px dashed #d8b4fe', background: '#faf5ff',
            color: '#7c3aed', fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
          }}
        >
          {busy
            ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                {phase === 'extracting' ? `Reading ${fileName}…` : `AI is analyzing ${fileName}… (this can take a minute)`}</>
            : <><FileUp size={15} /> Import from eSource — upload an existing eSource to detect preferences</>}
        </button>
        {error && <p style={{ color: '#dc2626', fontSize: 12.5, marginTop: 6 }}>{error}</p>}
      </div>
    );
  }

  // ---------- review ----------
  return (
    <div style={{ border: '1px solid #e9d5ff', borderRadius: 14, background: '#fdfbff', padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Sparkles size={15} color="#7c3aed" />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}>Detected from “{fileName}”</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{acceptedCount}/{allKeys.length} approved</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="lift" onClick={() => setAll('accepted')} style={{ ...bulkBtn, borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
            <Check size={13} /> Approve all
          </button>
          <button className="lift" onClick={() => setAll('rejected')} style={{ ...bulkBtn, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
            <X size={13} /> Reject all
          </button>
          <button className="lift" onClick={reset} title="Start over" style={bulkBtn}><RotateCcw size={13} /></button>
        </div>
      </div>
      {analysis.summary && <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>{analysis.summary}</p>}

      {/* Core preference toggles */}
      {prefItems.length > 0 && (
        <ReviewSection title="Detected preferences">
          {prefItems.map((p) => (
            <ReviewRow key={p.key} status={statusOf(p.key)} onSet={(s) => setStatus(p.key, s)}>
              <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{p.text}</span>
            </ReviewRow>
          ))}
        </ReviewSection>
      )}

      {/* Preference/rule statements */}
      {analysis.questions.length > 0 && (
        <ReviewSection title="Detected preference rules">
          {analysis.questions.map((q, i) => (
            <ReviewRow key={qKeys[i]} status={statusOf(qKeys[i])} onSet={(s) => setStatus(qKeys[i], s)}>
              <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>
                {q.text}{q.answerType === 'yesno' ? ` — ${q.answer === 'no' ? 'No' : 'Yes'}` : ''}
              </span>
              {q.confidence && <ConfidenceBadge level={q.confidence} compact />}
            </ReviewRow>
          ))}
        </ReviewSection>
      )}

      {/* Universal-rule overrides */}
      {analysis.ruleOverrides.length > 0 && (
        <ReviewSection title="Universal rules this eSource disables">
          {analysis.ruleOverrides.map((o) => (
            <ReviewRow key={`r:${o.id}`} status={statusOf(`r:${o.id}`)} onSet={(s) => setStatus(`r:${o.id}`, s)}>
              <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>{o.text} <b style={{ color: '#b91c1c' }}>— No</b></span>
              <ConfidenceBadge level={o.confidence} compact />
            </ReviewRow>
          ))}
        </ReviewSection>
      )}

      {/* Field preview */}
      {analysis.forms.length > 0 && (
        <ReviewSection title="Fields the AI will generate">
          {analysis.forms.map((form, fi) => (
            <div key={`${form.name}-${fi}`} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#475569', margin: '6px 0 2px' }}>{form.name}</p>
              {form.fields.map((f, xi) => {
                const key = `f:${fi}:${xi}`;
                return (
                  <ReviewRow key={key} status={statusOf(key)} onSet={(s) => setStatus(key, s)}>
                    <span style={{ flex: 1, fontSize: 13, color: '#1e293b' }}>
                      {f.label}{f.required && <span style={{ color: '#ef4444' }}> *</span>}
                      {f.options?.length ? <span style={{ color: '#94a3b8', fontSize: 11.5 }}> — {f.options.join(', ')}</span> : null}
                    </span>
                    <TypeBadge type={f.type} />
                    <ConfidenceBadge level={f.confidence} compact />
                  </ReviewRow>
                );
              })}
            </div>
          ))}
        </ReviewSection>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
        <Pill bg="#f3e8ff" color="#7c3aed">Approved items become the template</Pill>
        <button
          className="lift" disabled={acceptedCount === 0} onClick={() => onUseTemplate(buildTemplate())}
          style={{
            marginLeft: 'auto', padding: '10px 18px', borderRadius: 10, border: 'none',
            background: acceptedCount === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff', fontSize: 13, fontWeight: 700, cursor: acceptedCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Create template from {acceptedCount} approved item{acceptedCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

// The core toggles/values detected in the eSource, as reviewable rows.
function detectedPrefItems(p: EsourceAnalysis['preferences']): { key: string; prefKey: string; text: string; value: unknown }[] {
  const items: { key: string; prefKey: string; text: string; value: unknown }[] = [];
  const add = (prefKey: string, text: string, value: unknown) =>
    items.push({ key: `p:${prefKey}`, prefKey, text, value });
  if (p.dateFormat) add('dateFormat', `Date format: ${p.dateFormat}`, p.dateFormat);
  if (p.timeFormat) add('timeFormat', `Time format: ${p.timeFormat}`, p.timeFormat);
  if (p.requireSignature !== undefined) add('requireSignature', `Signature on consent/completion forms: ${p.requireSignature ? 'yes' : 'no'}`, p.requireSignature);
  if (p.documentUploadFields !== undefined) add('documentUploadFields', `Document-upload fields: ${p.documentUploadFields ? 'allowed' : 'not used'}`, p.documentUploadFields);
  if (p.generalSections !== undefined) add('generalSections', `General log sections (Medical History, Allergies, …): ${p.generalSections ? 'present' : 'absent'}`, p.generalSections);
  if (p.screeningOrder !== undefined) add('screeningOrder', `Canonical Screening form order: ${p.screeningOrder ? 'followed' : 'not followed'}`, p.screeningOrder);
  return items;
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>{title}</p>
      {children}
    </div>
  );
}

function ReviewRow({ status, onSet, children }: {
  status: ReviewStatus;
  onSet: (s: ReviewStatus) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8,
      background: status === 'accepted' ? '#f0fdf4' : status === 'rejected' ? '#fef2f2' : 'transparent',
      opacity: status === 'rejected' ? 0.6 : 1,
    }}>
      {children}
      <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
        <button className="lift" onClick={() => onSet('accepted')} aria-label="Accept" style={{
          ...tickBtn, borderColor: status === 'accepted' ? '#86efac' : '#e2e8f0',
          background: status === 'accepted' ? '#dcfce7' : '#fff', color: status === 'accepted' ? '#15803d' : '#94a3b8',
        }}><Check size={12} /></button>
        <button className="lift" onClick={() => onSet('rejected')} aria-label="Reject" style={{
          ...tickBtn, borderColor: status === 'rejected' ? '#fca5a5' : '#e2e8f0',
          background: status === 'rejected' ? '#fee2e2' : '#fff', color: status === 'rejected' ? '#b91c1c' : '#94a3b8',
        }}><X size={12} /></button>
      </span>
    </div>
  );
}

const bulkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8,
  border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
const tickBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24,
  borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer',
};
