import type {
  StudyModel,
  StudyField,
  StudyVisit,
  StudyForm,
  IngestedDocument,
} from '../types/study';

export interface BuildOptions {
  /** Free-text extra instructions appended to the system prompt. */
  customInstructions?: string;
  /** Approximate number of visits/logs to model. */
  visitCount?: number;
  detailLevel?: 'concise' | 'standard' | 'detailed';
}

export const DEFAULT_OPTIONS: Required<Omit<BuildOptions, 'customInstructions'>> & { customInstructions: string } = {
  customInstructions: '',
  visitCount: 30,
  detailLevel: 'detailed',
};

// Azure OpenAI configuration — all values come from env (no secret in source).
// ENDPOINT e.g. "https://<resource>.openai.azure.com/". DEPLOYMENT is the name
// you gave the model deployment in the Azure portal (NOT necessarily the model
// name) and goes in the request URL. API_VERSION pins the Azure REST contract.
const AZURE_ENDPOINT = ((import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string) || '').replace(/\/+$/, '');
const AZURE_API_KEY = import.meta.env.VITE_AZURE_OPENAI_API_KEY as string;
const AZURE_DEPLOYMENT = (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string) || 'gpt-4o';
const AZURE_API_VERSION = (import.meta.env.VITE_AZURE_OPENAI_API_VERSION as string) || '2024-10-21';

export const isConfigured = !!AZURE_API_KEY && !!AZURE_ENDPOINT;

// gpt-5-family deployments use `max_completion_tokens` (not `max_tokens`), accept
// `reasoning_effort`, and only support the default temperature — so the request
// body adapts. Detected from the deployment name (e.g. name it "gpt-5.5").
const isGpt5Family = /gpt-5/i.test(AZURE_DEPLOYMENT);

// Shared context guidance reused by both build phases.
const DOC_ROLES = `DOCUMENT ROLES — when multiple documents are provided, recognize what each is FOR:
- The Clinical Study Protocol (the document containing the Schedule of Activities / Table of Procedures, objectives, eligibility, and visit timing) is the AUTHORITATIVE source for the VISIT SCHEDULE.
- A "CRF Completion Requirements" / "EDC Completion Guidelines" data-entry guide describes how to FILL forms/fields (labels, formats, completion guidance). Use it to enrich field-level detail — NEVER to define the visit schedule, and never treat it as the primary protocol when a real protocol with an SOA is present.
- When both are present, build visits from the protocol's SOA and layer field detail from the CRF guide where form names match.`;

// ===== PHASE A — skeleton: the COMPLETE visit/log schedule + form NAMES only.
// Output stays small (no fields), so the model can spend all its effort getting
// the full SOA visit list right without risking output-token truncation. =====
const SKELETON_SYSTEM_PROMPT = `You are an expert clinical-trial eSource builder. In THIS step you extract the STUDY STRUCTURE ONLY: study metadata, the COMPLETE visit/log schedule driven by the Schedule of Activities (SOA), and the NAMES of the forms collected at each visit. You do NOT produce fields in this step.

${DOC_ROLES}

WORKFLOW:
1. Identify the PRIMARY protocol (the one with the SOA). Extract study title, protocol number, phase, indication, sponsor, objectives, and inclusion/exclusion criteria.
2. Locate the SOA table ("Schedule of Activities/Assessments/Procedures/Events", or a numbered table such as "Table 3"). Its column headers ARE the visits — read them directly off the table; never infer from prose or from a "typical" trial.
   - The SOA is extracted from a PDF, so its grid is flattened and may look scrambled: a multi-row header where visit labels are split across lines (e.g. a "Visit" row "1 2 3 3 4 4 4 4 5 6 ..." with sub-labels "a b a b c d ..." beneath, forming 1, 2, 3a, 3b, 4a, 4b, 4c, 4d, 5, 6, ...), a "Study Day(s)" row giving each visit's day, and "Study Phase" groupings (Screening, Baseline, Treatment, Follow-up). Reconstruct the FULL ordered visit list, pairing each label with its study day. Treat sub-visits (3a/3b) as DISTINCT visits. Do NOT collapse into broad phases (never output just "Treatment Period").
3. Output EVERY visit column LEFT-TO-RIGHT in exact order:
   - Capture ALL columns including the first and last (incl. EOS, ET/EDD, Unscheduled). Do not drop, skip, merge, deduplicate, or stop early. If the SOA has 30 columns, output 30 visits.
   - Use the EXACT label shown. Do not renumber, relabel, round, or convert (never turn "Day 1" into "Week 1").
   - Capture each visit's timing and window from the header/footnotes (e.g. "Day -28", "±3 days").
   - Continuous logs spanning the whole study (Adverse Events, Concomitant Medications, etc.) are kind "log"; everything tied to a specific SOA column is kind "visit".
   - Re-count before finishing: the number of "visit" entries MUST equal the number of SOA visit columns. If they differ, you missed columns.
4. For each visit, list the FORMS collected at it (by NAME only). Every procedure marked in that visit's column becomes a form. Use standard names where they match: Informed Consent, Demographics, Eligibility / Inclusion-Exclusion, Medical History, Vital Signs, Physical Examination, Laboratory, ECG, Concomitant Medications, Adverse Events, Pharmacokinetics, Questionnaires, Disposition / End of Study, etc.

Output ONLY valid JSON (NO fields and NO rules in this step):
{
  "studyTitle": "string",
  "studyDescription": "string (1-2 sentences)",
  "protocolNumber": "string or null",
  "sponsor": "string or null",
  "phase": "string or null",
  "indication": "string or null",
  "objectives": "string or null",
  "visits": [
    {
      "id": "v1",
      "name": "string (exact SOA label)",
      "kind": "visit | log",
      "timing": "string or null",
      "window": "string or null",
      "forms": [
        { "name": "string", "description": "string or null", "appliedTemplate": "Adverse Event Log | Concomitant Medication Log | Vital Signs | Medical History | null" }
      ]
    }
  ],
  "eligibility": [
    { "id": "e1", "kind": "inclusion | exclusion", "criterion": "original text", "logic": "pass/fail logic", "confidence": "high|medium|low" }
  ],
  "findings": [
    { "id": "fnd1", "title": "string", "description": "string", "source": "string", "confidence": "high|medium|low", "severity": "info|warning|blocker", "suggestedAction": "review | block" }
  ]
}

Rules:
- The "visits" array MUST contain one entry per SOA visit COLUMN (kind "visit"), in left-to-right order, with the exact labels — do not sample, summarize, reorder, rename, or cap to a round number. This is the single most important requirement of this step.
- Every visit MUST list at least one form name. Forms have NO fields in this step.
- If NO SOA table exists in ANY document, infer a best-effort schedule (Screening, Baseline, Day 1, Week 1, Week 2, … plus follow-up) and add a "blocker" finding stating no SOA was found.
- Convert inclusion/exclusion criteria into eligibility items with pass/fail logic. Produce 3-6 findings, at least one "blocker".
- Return ONLY the JSON object. No markdown, no prose.`;

// ===== PHASE B — enrich ONE form into its complete, sectioned questionnaire.
// Bounded output per call (one form), so detailed forms never truncate. =====
const ENRICH_SYSTEM_PROMPT = `You are an expert clinical-trial eSource builder. Given source-document excerpts and ONE target form, produce the COMPLETE, detailed list of typed fields for that form — a real eSource questionnaire grouped into sections.

${DOC_ROLES}

For the TARGET FORM:
- COMPLETENESS — search the excerpts (especially any CRF/EDC Completion Requirements guide) for this form and emit EVERY field it defines. When the guide enumerates fields as numbered sub-items (e.g. "3.16.1 Category", "3.16.2 AE ID", … through "3.16.18 …"), reproduce EACH as its own field with the exact label and its data-entry instruction in completionGuidance. Do NOT truncate, sample, or stop at a "typical" handful — rich forms (Adverse Events, Laboratory, Concomitant Medications, ECG) commonly run 12-25+ fields. Use fewer only when the source genuinely defines fewer.
- CONDITIONAL FIELDS — reproduce dependent/branching fields ("If Yes, record …", "If abnormal, …", "If Other, specify") as their own fields, state the trigger in completionGuidance, and add a matching "required-if" rule.
- SECTIONS — set the "section" property on every field to group the form into correctly named subsections, in source order (e.g. Vital Signs → "Anthropometry" then "Blood Pressure & Pulse"; Adverse Events → "Event Details", "Seriousness", "Causality", "Action & Outcome"). Do not leave fields ungrouped when the form has more than ~5 fields.
- TYPES — choose the best field type (integer/decimal for numerics, datetime for date+time, multiselect for pick-many, signature for sign-offs, file for uploads, calculated with an "expression" for derived values like BMI/Age). Only include "options" for select/multiselect/radio/checkbox.
- TRACEABILITY — every field includes source (document name), and where determinable protocolSection, page, a short originalText snippet, and a confidence. Include at least one or two "low"/"medium" confidence fields where the source is ambiguous.
- Give EVERY field a completionGuidance. Provide 1-3 sensible validation rules for the form.

Output ONLY valid JSON for THIS one form:
{
  "fields": [
    {
      "label": "string",
      "type": "text|textarea|number|integer|decimal|date|datetime|time|select|multiselect|radio|checkbox|yesno|signature|file|calculated",
      "required": true,
      "options": ["..."],
      "section": "string or null",
      "expression": "string or null (only for 'calculated')",
      "confidence": "high|medium|low",
      "completionGuidance": "string",
      "source": "string (source document name)",
      "protocolSection": "string or null",
      "page": "number or null",
      "originalText": "string or null"
    }
  ],
  "rules": [
    { "description": "string", "ruleType": "range|required-if|cross-field|format|date-not-future|within-visit-window", "confidence": "high|medium|low" }
  ]
}
Return ONLY the JSON object. No markdown, no prose.`;

// Per-form field-count guidance, driven by the detailLevel option.
function enrichDetailLine(o: Required<Omit<BuildOptions, 'customInstructions'>> & { customInstructions: string }): string {
  if (o.detailLevel === 'concise') return 'Keep it lean: the most important 4-6 fields, still grouped into sections.';
  if (o.detailLevel === 'detailed') return 'Be EXHAUSTIVE: emit every field the source defines for this form (12-25+ for rich forms), reproducing every enumerated sub-item, all grouped into sections.';
  return 'Use a realistic field count that follows the source (typically 6-12, more when the source enumerates more), grouped into sections.';
}

// Raw shape returned by the model (before we attach review state / IDs).
interface RawStudy {
  studyTitle?: string;
  studyDescription?: string;
  protocolNumber?: string | null;
  sponsor?: string | null;
  phase?: string | null;
  indication?: string | null;
  objectives?: string | null;
  visits?: RawVisit[];
  eligibility?: StudyModel['eligibility'];
  findings?: Array<Omit<StudyModel['findings'][number], 'resolved'>>;
}
interface RawVisit extends Omit<StudyVisit, 'forms'> { forms?: RawForm[] }
interface RawForm extends Omit<StudyForm, 'fields' | 'rules'> {
  fields?: Array<Omit<StudyField, 'reviewStatus'>>;
  rules?: Array<Omit<StudyForm['rules'][number], 'accepted'>>;
}

// gpt-4.1 and gpt-5 family accept very large inputs (hundreds of thousands of
// tokens), so the whole corpus is passed in one call for the skeleton — the SOA
// is never split across chunks. This bound is just a safety cap.
const MAX_CONTEXT_CHARS = 1_000_000;
// The skeleton call must fit the deployment's tokens-per-minute budget, so its
// input is capped. The SOA table can sit deep in a long protocol, so the input
// is assembled from the relevant regions (synopsis + SOA + eligibility) rather
// than naively truncating the start. ~165k chars ≈ ~41k tokens.
const SKELETON_MAX_CHARS = 165000;
// Per-form enrichment only needs the slice of the documents around that form, so
// each enrich call sends a focused excerpt rather than the whole corpus.
const ENRICH_EXCERPT_CHARS = 16000;
// Concurrency cap for the parallel per-form enrichment calls. Kept low so a
// modest deployment TPM quota is not blown by many simultaneous calls.
const ENRICH_CONCURRENCY = 2;
// max_completion_tokens (gpt-5) / max_tokens (others). The skeleton (no fields)
// and each single-form enrichment both stay well under these caps.
const MAX_OUTPUT_TOKENS = isGpt5Family ? 65536 : 32768;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// One chat-completion call that returns the parsed JSON object the model emits.
// Retries on 429/503 (Azure tokens-per-minute / requests-per-minute throttling),
// honoring the Retry-After header when present, with exponential backoff.
async function callModel(systemPrompt: string, userContent: string): Promise<any> {
  const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;
  const requestBody = JSON.stringify({
    // On Azure the model is selected by the deployment in the URL, not the body.
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    // GPT-5 family renamed the output-token cap, ignores custom temperature,
    // and accepts reasoning_effort (none|low|medium|high|xhigh) — keep it low
    // so the token budget is spent on the JSON output, not hidden reasoning.
    ...(isGpt5Family
      ? { max_completion_tokens: MAX_OUTPUT_TOKENS, reasoning_effort: 'low' }
      : { max_tokens: MAX_OUTPUT_TOKENS, temperature: 0.3 }),
    response_format: { type: 'json_object' },
  });

  const MAX_RETRIES = 5;
  let res!: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': AZURE_API_KEY },
      body: requestBody,
    });
    if (res.ok || (res.status !== 429 && res.status !== 503) || attempt >= MAX_RETRIES) break;
    // Respect Retry-After (seconds) when Azure provides it; else exponential backoff.
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(2000 * 2 ** attempt, 30000);
    await sleep(waitMs);
  }

  if (!res.ok) {
    const errBody = await res.text();
    const hint = res.status === 429
      ? ' — the deployment is throttling (tokens/requests-per-minute quota). Try again shortly or raise the deployment quota in Azure.'
      : '';
    throw new Error(`Azure OpenAI API error ${res.status}: ${errBody}${hint}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string | null }; finish_reason: string }>;
  };
  const choice = data.choices[0];
  let jsonText = choice?.message?.content?.trim() ?? '';
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  if (!jsonText) {
    throw new Error(
      `Model returned no content (finish_reason: ${choice?.finish_reason ?? 'unknown'}).`
    );
  }
  if (choice?.finish_reason === 'length') {
    throw new Error('Model response was truncated (finish_reason: length) before the JSON was complete.');
  }

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error('Model returned invalid/incomplete JSON (likely truncated).');
  }
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

// The skeleton phase only needs the protocol (the SOA + eligibility + metadata),
// not the CRF/EDC completion guide — so when extractText has tagged the
// SOA-bearing document(s), send only those. This keeps the single big skeleton
// call smaller (fewer tokens → less likely to hit the deployment's rate limit)
// and more focused. Falls back to the full corpus when nothing is tagged.
function soaDocsOnly(corpus: string): string {
  const parts = corpus.split(/\n(?====== DOCUMENT \d+ of \d+:)/);
  if (parts.length <= 1) return corpus;
  const soa = parts.filter(p => /contains Schedule of Activities/i.test(p.split('\n', 1)[0] ?? ''));
  return soa.length ? soa.join('\n') : corpus;
}

// Assemble a focused, size-capped skeleton input from the protocol: the synopsis
// (start), the Schedule of Activities table, and the eligibility criteria. A long
// protocol can place the SOA past a naive truncation point, so each region is
// located by anchor and a window around it is kept. Falls back to the whole doc
// when it already fits.
function skeletonInput(corpus: string): string {
  const doc = soaDocsOnly(corpus);
  if (doc.length <= SKELETON_MAX_CHARS) return doc;

  const wide: RegExp[] = [
    /schedule of (activities|assessments|procedures|events)/i,
    /\bvisit\b[\s\S]{0,60}\bstudy\s*day/i,
  ];
  const narrow: RegExp[] = [/inclusion criteria/i, /exclusion criteria/i];

  const windows: Array<[number, number]> = [[0, 45000]]; // title page + synopsis
  for (const re of wide) {
    const m = re.exec(doc);
    if (m) windows.push([Math.max(0, m.index - 2000), Math.min(doc.length, m.index + 95000)]);
  }
  for (const re of narrow) {
    const m = re.exec(doc);
    if (m) windows.push([Math.max(0, m.index - 1000), Math.min(doc.length, m.index + 25000)]);
  }

  windows.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else merged.push([w[0], w[1]]);
  }
  let out = '';
  for (const [s, e] of merged) {
    out += doc.slice(s, e) + '\n…\n';
    if (out.length >= SKELETON_MAX_CHARS) break;
  }
  return out.slice(0, SKELETON_MAX_CHARS);
}

// Run an async fn over items with bounded concurrency, preserving input order.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Build a focused excerpt of the corpus around mentions of a form name, so each
// enrichment call sends only the relevant slice rather than the whole document.
function excerptFor(corpus: string, formName: string, maxChars = ENRICH_EXCERPT_CHARS): string {
  const hay = corpus.toLowerCase();
  const needle = norm(formName);
  if (!needle) return corpus.slice(0, maxChars);

  const windows: Array<[number, number]> = [];
  let from = 0;
  while (windows.length < 4) {
    const idx = hay.indexOf(needle, from);
    if (idx === -1) break;
    windows.push([Math.max(0, idx - 1500), Math.min(corpus.length, idx + 6500)]);
    from = idx + needle.length;
  }
  if (!windows.length) return corpus.slice(0, maxChars);

  // Merge overlapping windows, then concatenate up to the char budget.
  windows.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1]);
    else merged.push([w[0], w[1]]);
  }
  let out = '';
  for (const [s, e] of merged) {
    out += corpus.slice(s, e) + '\n…\n';
    if (out.length >= maxChars) break;
  }
  return out.slice(0, maxChars);
}

export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {}
): Promise<StudyModel> {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const corpus = protocolText.length > MAX_CONTEXT_CHARS ? protocolText.slice(0, MAX_CONTEXT_CHARS) : protocolText;
  const customLine = o.customInstructions.trim()
    ? `\n\nUser custom instructions (follow closely):\n${o.customInstructions.trim()}`
    : '';

  // ---- Phase A: extract the COMPLETE visit/log schedule + form names (one call,
  // full corpus, small output). This is where the full SOA is read. ----
  const skeleton = (await callModel(
    SKELETON_SYSTEM_PROMPT + customLine,
    `Extract the study structure — the COMPLETE visit/log schedule from the SOA, plus the form names collected at each visit — from the following source document(s):\n\n${skeletonInput(corpus)}`
  )) as RawStudy;

  const visits = skeleton.visits ?? [];

  // ---- Phase B: enrich each UNIQUE form name once (parallel, bounded output per
  // call), then attach the resulting fields to every visit that has that form. ----
  const uniqueForms = new Map<string, RawForm>();
  for (const v of visits)
    for (const f of v.forms ?? []) {
      const key = norm(f.name);
      if (key && !uniqueForms.has(key)) uniqueForms.set(key, f);
    }

  const detailLine = enrichDetailLine(o);
  const enriched = await mapPool([...uniqueForms.values()], ENRICH_CONCURRENCY, async (form) => {
    const user =
      `STUDY: ${skeleton.studyTitle ?? ''}${skeleton.indication ? ` — ${skeleton.indication}` : ''}. ${detailLine}\n` +
      `TARGET FORM: "${form.name}"${form.description ? ` — ${form.description}` : ''}.${customLine}\n\n` +
      `Build the complete, sectioned field list for THIS form only, using the document excerpts below.\n\n` +
      `===== SOURCE EXCERPTS =====\n${excerptFor(corpus, form.name)}`;
    try {
      const r = await callModel(ENRICH_SYSTEM_PROMPT, user);
      return { key: norm(form.name), fields: r.fields ?? [], rules: r.rules ?? [] };
    } catch {
      // A failed form simply comes back empty and is dropped by normalizeStudy.
      return { key: norm(form.name), fields: [] as RawForm['fields'], rules: [] as RawForm['rules'] };
    }
  });
  const byForm = new Map(enriched.map((e) => [e.key, e]));

  for (const v of visits) {
    v.forms = (v.forms ?? []).map((f) => {
      const e = byForm.get(norm(f.name));
      return e ? { ...f, fields: e.fields, rules: e.rules } : f;
    });
  }

  return normalizeStudy(skeleton, documents);
}

// Attach review state, fill defaults, and guarantee stable IDs.
function normalizeStudy(raw: RawStudy, documents: IngestedDocument[]): StudyModel {
  let fieldSeq = 0;
  let ruleSeq = 0;

  const visits: StudyVisit[] = (raw.visits ?? []).map((v, vi): StudyVisit => ({
    id: v.id || `v${vi + 1}`,
    name: v.name || `Visit ${vi + 1}`,
    kind: v.kind === 'log' ? 'log' : 'visit',
    timing: v.timing || undefined,
    window: v.window || undefined,
    forms: (v.forms ?? [])
      // Drop forms that carry no fields — they add empty noise to the UI.
      .filter(f => (f.fields ?? []).length > 0)
      .map((f, fi): StudyForm => ({
      id: f.id || `v${vi + 1}f${fi + 1}`,
      name: f.name || `Form ${fi + 1}`,
      description: f.description || undefined,
      appliedTemplate: f.appliedTemplate || null,
      fields: (f.fields ?? []).map((fld): StudyField => ({
        id: fld.id || `fld${++fieldSeq}`,
        label: fld.label || 'Untitled field',
        type: fld.type || 'text',
        required: !!fld.required,
        options: fld.options,
        section: fld.section || undefined,
        expression: fld.expression || undefined,
        confidence: fld.confidence || 'medium',
        completionGuidance: fld.completionGuidance,
        source: fld.source,
        protocolSection: fld.protocolSection || undefined,
        page: typeof fld.page === 'number' ? fld.page : undefined,
        originalText: fld.originalText || undefined,
        reviewStatus: 'pending',
      })),
      rules: (f.rules ?? []).map((r): StudyForm['rules'][number] => ({
        id: r.id || `r${++ruleSeq}`,
        description: r.description || '',
        ruleType: r.ruleType || 'range',
        confidence: r.confidence || 'medium',
        accepted: null,
      })),
    })),
  }))
    // Drop visits with no populated forms (e.g. timepoints mentioned but never scheduled).
    .filter(v => v.forms.length > 0);

  return {
    studyTitle: raw.studyTitle || 'Untitled Study',
    studyDescription: raw.studyDescription || '',
    protocolNumber: raw.protocolNumber || undefined,
    sponsor: raw.sponsor || undefined,
    phase: raw.phase || undefined,
    indication: raw.indication || undefined,
    objectives: raw.objectives || undefined,
    documents,
    visits,
    eligibility: (raw.eligibility ?? []).map((e, i) => ({
      ...e,
      id: e.id || `e${i + 1}`,
      confidence: e.confidence || 'medium',
    })),
    findings: (raw.findings ?? []).map((f, i) => ({
      ...f,
      id: f.id || `fnd${i + 1}`,
      confidence: f.confidence || 'medium',
      severity: f.severity || 'warning',
      suggestedAction: f.suggestedAction || 'review',
      resolved: false,
    })),
  };
}
