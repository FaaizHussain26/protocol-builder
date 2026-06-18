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

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const OPENAI_MODEL = 'gpt-5.5';

export const isConfigured = !!OPENAI_KEY;

// GPT-5-family models use `max_completion_tokens` (not `max_tokens`) and only
// support the default temperature, so the request body must adapt to the model.
const isGpt5Family = /^gpt-5/i.test(OPENAI_MODEL);

const BASE_SYSTEM_PROMPT = `You are an expert clinical-trial eSource builder. You read one or more uploaded study documents (Clinical Study Protocol, Schedule of Activities/Assessments (SOA), Laboratory/Pharmacy/Imaging manuals, Questionnaires, study guidelines, sponsor references) and produce a STRUCTURED, EDITABLE eSource STUDY MODEL — visits → forms → typed fields — driven by the Schedule of Activities. This is not a flat list of questions.

DOCUMENT ROLES — when multiple documents are provided, recognize what each is FOR:
- The Clinical Study Protocol (the document that contains the Schedule of Activities / Table of Procedures, objectives, eligibility, and visit timing) is the AUTHORITATIVE source for the VISIT SCHEDULE. The visit list MUST come from this document's SOA.
- A "CRF Completion Requirements", "EDC Completion Guidelines", or similar data-entry guide describes how to FILL forms/fields (field labels, formats, completion guidance). Use it ONLY to enrich field-level detail and completion guidance — NEVER use it to define the visit schedule, and NEVER treat it as the primary protocol when an actual protocol with an SOA is also present.
- If you find an SOA in the protocol, the CRF/EDC guide does NOT override it. Build visits from the protocol's SOA, then layer in field detail from the CRF guide where the form names match.

WORKFLOW — follow in order:
1. Identify the PRIMARY protocol among the documents — the one containing the Schedule of Activities and study design (NOT a CRF/EDC completion guide). Extract: study name, protocol number, phase, indication, sponsor, study objectives, and inclusion/exclusion criteria. Understand protocol structure even when formatting differs between studies.
2. Locate the Schedule of Activities (SOA) table. It may be titled "Schedule of Activities", "Schedule of Assessments", "Schedule of Procedures/Assessments", "Schedule of Events", or appear as a numbered table (e.g. "Table 3"). This table is the AUTHORITATIVE source for visits — the column headers ARE the visits. Do not infer visits from prose or from your own expectations of a "typical" trial; read them directly off the SOA.
   - IMPORTANT: the SOA is extracted from a PDF, so its grid is flattened to text and may look scrambled — a multi-row/rotated header where visit labels are split across lines (e.g. "Visit" then a row like "1 2 3 3 4 4 4 4 5 6 ..." with sub-labels "a b a b c d ..." on the next line, forming visits 1, 2, 3a, 3b, 4a, 4b, 4c, 4d, 5, 6, ...), a "Study Day(s)" row giving each visit's day, and "Study Phase" groupings (e.g. Screening, Baseline, Treatment, Follow-up). Carefully reconstruct the FULL ordered list of visit columns from these header rows, pairing each visit label with its study day. Treat sub-visits like "3a"/"3b" as distinct visits. Do NOT collapse the table into a few broad phases (e.g. do not output just "Treatment Period") — output each individual visit column.
3. Extract EVERY patient visit/timepoint from the SOA, reading the column headers strictly LEFT-TO-RIGHT and reproducing them IN THAT EXACT ORDER. Critical rules for this step:
   - Capture ALL columns, including the first and last. Do not drop, skip, merge, or deduplicate visits, and do not stop early. If the SOA has 14 visit columns, output 14 visits.
   - Use the EXACT visit name/label printed in the SOA header (e.g. "Screening", "Baseline", "Day 1", "Week 2", "Week 4", "Week 8", "Week 12", "End of Treatment", "End of Study", "Follow-Up"). Do NOT renumber, relabel, round, or convert (e.g. never turn "Day 1" into "Week 1", never collapse "Week 4" and "Week 8" into one).
   - Preserve every intermediate timepoint. If the SOA lists Week 2, 4, 8, 12, 16 you must emit ALL of them — do not output only some (this is the cause of visits appearing in "odd" or irregular numbers). Sequential numeric timepoints must be complete and monotonic.
   - For each visit, capture its timing and window from the SOA header / footnotes (e.g. "Day -28 to -1", "±3 days").
   - Continuous/unscheduled logs that span the whole study rather than a single column (Adverse Events, Concomitant Medications) are kind "log"; everything tied to a specific SOA column is kind "visit".
   - Before moving on, re-count: the number of "visit" entries you emit MUST equal the number of scheduled visit columns in the SOA. If they differ, you missed columns — go back and read them all.
4. Read the SOA cells: a marker ("X", "✓", "Required", "Optional", "Conditional") means that procedure/form is collected at that visit. Map each marked procedure to a FORM under that visit. A procedure marked across multiple visits produces a form under EACH of those visits.
5. For each procedure/form, SEARCH the full protocol and supporting documents for the data-collection details and generate protocol-specific fields — never generic placeholders. (e.g. "Vital Signs" → Systolic BP, Diastolic BP, Heart Rate, Respiratory Rate, Temperature, Height, Weight, BMI; "Demographics" → Subject ID, Initials, Date of Birth, Age, Sex, Race, Ethnicity.)
   - COMPLETENESS — each form is a COMPLETE eSource questionnaire, not a sample. When a CRF/EDC Completion Requirements guide (or the protocol) enumerates the fields of a form — often as numbered sub-items, e.g. "3.16.1 Category", "3.16.2 AE ID", … through "3.16.18 …" — emit EVERY one of those sub-items as its own field, using the exact field label and capturing its data-entry instruction in completionGuidance. Do NOT truncate, sample, deduplicate, or stop at a "typical" handful: a real CRF form commonly has 10-25+ fields, and AE / Concomitant Medication / Laboratory forms have even more. Capture every numbered field in the source.
   - CONDITIONAL FIELDS — reproduce dependent/branching fields too (e.g. "If Yes, record First Study Identifier / First Site Identifier", "If serious, …", "If Other, specify") as their own fields, and state the triggering condition in completionGuidance. Add a matching "required-if" rule where appropriate.
   - SECTIONS — organize each form's fields into logical, correctly named subsections via the "section" property, in source order, so the questionnaire renders as grouped sections rather than one flat list (e.g. Vital Signs → "Anthropometry": Height / Weight / BMI, then "Blood Pressure & Pulse": Systolic / Diastolic / Pulse; Adverse Events → "Event Details", "Seriousness", "Causality", "Action Taken & Outcome"). Fields collected together share the same section name; do not leave fields ungrouped when a form has more than ~5 fields.
6. For every field, choose the best field type, add validation rules and required flags, and record full traceability.

Your output MUST be valid JSON matching this EXACT structure:
{
  "studyTitle": "string",
  "studyDescription": "string (1-2 sentences)",
  "protocolNumber": "string or null",
  "sponsor": "string or null",
  "phase": "string or null (e.g. 'Phase II')",
  "indication": "string or null",
  "objectives": "string or null (primary/secondary objectives, brief)",
  "visits": [
    {
      "id": "v1",
      "name": "string (e.g. 'Screening', 'Baseline', 'Week 4', 'End of Study')",
      "kind": "visit | log",
      "timing": "string (e.g. 'Day -28 to -1', 'Week 4')",
      "window": "string (e.g. '±3 days') or null",
      "forms": [
        {
          "id": "f1",
          "name": "string (e.g. 'Vital Signs', 'Adverse Events')",
          "description": "string or null",
          "appliedTemplate": "string or null (one of: 'Adverse Event Log','Concomitant Medication Log','Vital Signs','Medical History' when the form clearly matches, else null)",
          "fields": [
            {
              "id": "fld1",
              "label": "string",
              "type": "text|textarea|number|integer|decimal|date|datetime|time|select|multiselect|radio|checkbox|yesno|signature|file|calculated",
              "required": true,
              "options": ["..."],
              "section": "string or null — optional grouping within the form",
              "expression": "string or null — only for type 'calculated' (e.g. 'weight / (height/100)^2')",
              "confidence": "high|medium|low",
              "completionGuidance": "string — plain instruction for site staff",
              "source": "string — source document name",
              "protocolSection": "string — e.g. '§6.1' (or null)",
              "page": "number or null — page in the source document",
              "originalText": "string — short verbatim snippet the field derives from (or null)"
            }
          ],
          "rules": [
            {
              "id": "r1",
              "description": "string — e.g. 'Systolic BP must be between 60 and 250 mmHg'",
              "ruleType": "range|required-if|cross-field|format|date-not-future|within-visit-window",
              "confidence": "high|medium|low"
            }
          ]
        }
      ]
    }
  ],
  "eligibility": [
    {
      "id": "e1",
      "kind": "inclusion | exclusion",
      "criterion": "string — original criterion text",
      "logic": "string — suggested pass/fail logic in plain language",
      "confidence": "high|medium|low"
    }
  ],
  "findings": [
    {
      "id": "fnd1",
      "title": "string — short title",
      "description": "string — what the issue is",
      "source": "string — e.g. 'Protocol §6.1 vs. Schedule of Activities'",
      "confidence": "high|medium|low",
      "severity": "info|warning|blocker",
      "suggestedAction": "review | block"
    }
  ]
}

Rules:
- Model the study as VISITS/LOGS → FORMS → FIELDS, driven by the SOA. Scheduled timepoints are kind "visit"; continuous logs (AE, ConMed) are kind "log".
- NEVER output an empty visit. Every visit/log in the "visits" array MUST contain at least one form with at least one field. Do NOT create a visit just because a timepoint (e.g. "Week 6") is mentioned somewhere in the text — only create a visit if you can actually populate it with the procedures/forms collected at it. Drop any timepoint you cannot populate. An empty "forms": [] array is invalid and must never appear.
- IF AND ONLY IF a real Schedule of Activities table is present: the "visits" array (kind "visit") should contain one entry per scheduled visit COLUMN that has collected procedures, in the same left-to-right order, with the exact SOA labels — do not sample, summarize, reorder, rename, or cap to a round number, and map each marked procedure to a form under that visit.
- IF NO Schedule of Activities table exists in ANY document (e.g. only a CRF/EDC Completion Requirements guide, a single manual, or prose is provided): build a best-effort visit schedule INFERRED from the visit/week/timepoint references found across the documents (e.g. Screening, Baseline, Day 1, Week 1, Week 2 … plus any follow-up). Aim for roughly the requested number of visits, name them as clinical visits with kind "visit" (never literally rename procedures), and CRUCIALLY populate EACH inferred visit with the forms and fields that the documents indicate are collected at it — every visit must have at least one form with fields. Distribute the described forms/fields across these visits sensibly rather than piling them all onto one visit. Also raise a "blocker" finding stating that no SOA table was found, so the inferred schedule should be reviewed. Never emit an empty inferred visit.
- Generate the standard clinical forms when the protocol supports them: Informed Consent, Demographics, Eligibility, Medical History, Concomitant Medications, Adverse Events, Vital Signs, Physical Examination, Laboratory Results, ECG, Imaging, Questionnaires, End of Study.
- SECTION COMPLETENESS: each visit's set of forms is the list of "sections" shown for that visit — it MUST be complete per the SOA: include every procedure marked at that visit as its own form, and make each form an EXHAUSTIVE questionnaire (every field the source defines for it), never a stub. Faithfully reproducing the source's enumerated fields always wins over inventing a generic subset. A form that the source describes with 18 fields must come back with ~18 fields, not 6.
- QUESTIONNAIRE GROUPING: in every multi-part form, set the "section" property on fields so the form renders as titled subsections, each holding its detailed questions in source order. Keep section names consistent across fields that belong together.
- Choose the most appropriate field type. Use 'integer'/'decimal' for numerics with the right precision, 'datetime' for date+time, 'multiselect' for pick-many, 'signature' for sign-offs (e.g. Informed Consent), 'file' for document uploads, 'calculated' for derived values (e.g. BMI, Age) and include an "expression".
- Only include "options" for select/multiselect/radio/checkbox field types.
- TRACEABILITY: every field MUST include source (document name), and where determinable protocolSection, page, and a short originalText snippet, plus a confidence. This ensures auditability.
- Give EVERY field a completionGuidance. You MUST include at least 2-3 fields marked "low" confidence (inferred or ambiguous fields) so they get flagged for human review, plus several "medium" and the rest "high". A build with zero low-confidence fields is invalid.
- Provide 1-2 suggested validation rules per form where sensible (plausible ranges, required-if logic, date-not-future for DOB, within-visit-window for visit dates).
- Convert inclusion/exclusion criteria into eligibility items with pass/fail logic.
- Produce 3-6 intelligence findings representing cross-document issues a reviewer should resolve before approving (e.g. a visit window that disagrees between protocol and SOA, a procedure marked in the SOA with no detail in the protocol, a missing expected form, an eligibility inconsistency). At least one should be a "blocker". These can be representative — they need not be exhaustively detected.
- When multiple documents are provided, attribute fields/findings to the right source document and synthesize them into ONE study.
- Return ONLY the JSON object. No markdown, no explanation.`;

function buildSystemPrompt(options: BuildOptions): string {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const lines = [BASE_SYSTEM_PROMPT, '', 'Additional requirements:'];
  lines.push(
    `- When a Schedule of Activities table exists, it is authoritative for the number and order of visits — extract ALL of its populated columns even if that is far more than ${o.visitCount}. The ${o.visitCount} figure is only a loose upper guideline, NOT a target: never pad the output with empty or fabricated visits to reach it. If the documents contain no SOA, return only the few visits/logs you can actually populate with forms.`
  );
  if (o.detailLevel === 'concise') lines.push('- Keep field counts lean (the most important 4-6 fields per form), but still group them into sections.');
  else if (o.detailLevel === 'detailed') lines.push('- Be EXHAUSTIVE: capture EVERY field the source documents define for each form — do NOT cap at a round number. Rich forms (Adverse Events, Laboratory, Concomitant Medications, ECG) commonly run 12-25+ fields; reproduce every enumerated sub-item with rich completionGuidance, and organize all fields into correctly named sections. Use fewer fields only when the source genuinely defines fewer.');
  else lines.push('- Use a realistic field count that follows the source — typically 6-12 fields per form, more when the source enumerates more — grouped into sections.');
  if (o.customInstructions.trim()) {
    lines.push('', 'User custom instructions (follow closely):', o.customInstructions.trim());
  }
  return lines.join('\n');
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

// Source documents are split into chunks small enough that one chunk plus the
// system prompt, running skeleton, and completion all fit within a 128k-token
// context window. ~160k chars ≈ ~40k tokens, leaving ample room for output.
const MAX_CHUNK_CHARS = 160000;
// GPT-5-family models are reasoning models: max_completion_tokens is shared
// between (hidden) reasoning tokens and the visible JSON output. A small budget
// gets consumed by reasoning and truncates the JSON, so give a generous cap.
// Exhaustive per-form questionnaires produce large JSON, so keep this high to
// avoid finish_reason:"length" truncation on the single-call (small-doc) path.
const MAX_OUTPUT_TOKENS = isGpt5Family ? 65536 : 16384;

// One chat-completion call that returns a parsed RawStudy JSON object.
async function callModel(systemPrompt: string, userContent: string): Promise<RawStudy> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
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
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string | null }; finish_reason: string }>;
  };
  const choice = data.choices[0];
  let jsonText = choice?.message?.content?.trim() ?? '';
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  if (!jsonText) {
    throw new Error(
      `Model returned no content (finish_reason: ${choice?.finish_reason ?? 'unknown'}). ` +
        `If this is "length", the output token limit was exhausted — reduce MAX_CHUNK_CHARS or raise MAX_OUTPUT_TOKENS.`
    );
  }
  if (choice?.finish_reason === 'length') {
    throw new Error(
      'Model response was truncated (finish_reason: length) before the JSON was complete. ' +
        'Reduce MAX_CHUNK_CHARS so each part produces less output, or raise MAX_OUTPUT_TOKENS.'
    );
  }

  try {
    return JSON.parse(jsonText) as RawStudy;
  } catch {
    throw new Error('Model returned invalid/incomplete JSON. This usually means the response was truncated; try reducing MAX_CHUNK_CHARS.');
  }
}

// Split combined source text into context-sized chunks, preferring to break on
// document, then page, then paragraph boundaries so tables (the SOA especially)
// stay intact within a single chunk.
function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const segments = text.split(/(?=\n===== DOCUMENT)|(?=\n\[Page )|(?=\n\n)/);
  const chunks: string[] = [];
  let current = '';
  for (const seg of segments) {
    if (seg.length > maxChars) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < seg.length; i += maxChars) chunks.push(seg.slice(i, i + maxChars));
      continue;
    }
    if (current.length + seg.length > maxChars) {
      chunks.push(current);
      current = seg;
    } else {
      current += seg;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

// Compact list of visits/forms extracted so far, given to later chunks so the
// model reuses the same names and partial results merge cleanly.
function skeletonSummary(acc: RawStudy): string {
  const visits = (acc.visits ?? []).map(v => {
    const forms = (v.forms ?? []).map(f => f.name).filter(Boolean).join(', ');
    return `- ${v.name}${v.timing ? ` (${v.timing})` : ''}${forms ? ` → forms: ${forms}` : ''}`;
  });
  return visits.length ? visits.join('\n') : '(nothing extracted yet)';
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

// Merge a newly-returned partial study into the accumulator, deduplicating by
// visit name, form name (within a visit), field label, eligibility criterion,
// and finding title.
function mergeRawStudies(a: RawStudy, b: RawStudy): RawStudy {
  const out: RawStudy = {
    studyTitle: a.studyTitle || b.studyTitle,
    studyDescription: a.studyDescription || b.studyDescription,
    protocolNumber: a.protocolNumber ?? b.protocolNumber,
    sponsor: a.sponsor ?? b.sponsor,
    phase: a.phase ?? b.phase,
    indication: a.indication ?? b.indication,
    objectives: a.objectives ?? b.objectives,
    visits: [...(a.visits ?? [])],
    eligibility: [...(a.eligibility ?? [])],
    findings: [...(a.findings ?? [])],
  };

  for (const bv of b.visits ?? []) {
    const existing = out.visits!.find(av => norm(av.name) === norm(bv.name));
    if (!existing) { out.visits!.push(bv); continue; }
    existing.timing = existing.timing || bv.timing;
    existing.window = existing.window || bv.window;
    existing.forms = existing.forms ?? [];
    for (const bf of bv.forms ?? []) {
      const ef = existing.forms.find(f => norm(f.name) === norm(bf.name));
      if (!ef) { existing.forms.push(bf); continue; }
      ef.description = ef.description || bf.description;
      ef.appliedTemplate = ef.appliedTemplate || bf.appliedTemplate;
      ef.fields = ef.fields ?? [];
      const seenFields = new Set(ef.fields.map(x => norm(x.label)));
      for (const fld of bf.fields ?? []) {
        if (seenFields.has(norm(fld.label))) continue;
        ef.fields.push(fld);
        seenFields.add(norm(fld.label));
      }
      ef.rules = ef.rules ?? [];
      const seenRules = new Set(ef.rules.map(x => norm(x.description)));
      for (const r of bf.rules ?? []) {
        if (seenRules.has(norm(r.description))) continue;
        ef.rules.push(r);
        seenRules.add(norm(r.description));
      }
    }
  }

  const seenElig = new Set((out.eligibility ?? []).map(e => norm(e.criterion)));
  for (const e of b.eligibility ?? []) {
    if (seenElig.has(norm(e.criterion))) continue;
    out.eligibility!.push(e);
    seenElig.add(norm(e.criterion));
  }
  const seenFind = new Set((out.findings ?? []).map(f => norm(f.title)));
  for (const f of b.findings ?? []) {
    if (seenFind.has(norm(f.title))) continue;
    out.findings!.push(f);
    seenFind.add(norm(f.title));
  }
  return out;
}

export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {}
): Promise<StudyModel> {
  const systemPrompt = buildSystemPrompt(options);
  const chunks = splitIntoChunks(protocolText, MAX_CHUNK_CHARS);

  // Small inputs: a single call is enough.
  if (chunks.length === 1) {
    const raw = await callModel(
      systemPrompt,
      `Build a structured eSource study from the following source document(s):\n\n${chunks[0]}`
    );
    return normalizeStudy(raw, documents);
  }

  // Large inputs: process the FIRST chunk on its own to establish the visit
  // skeleton (the SOA-bearing document is sorted first), then process the
  // remaining chunks IN PARALLEL sharing that skeleton. This collapses N
  // sequential round-trips into two waves, which is dramatically faster, while
  // still letting later chunks reuse the protocol's visit/form names.
  const buildPrompt = (i: number, skeleton: string) =>
    `You are building ONE eSource study from documents split into ${chunks.length} parts. This is PART ${i + 1} of ${chunks.length}.\n\n` +
    `STRUCTURE EXTRACTED FROM OTHER PARTS — reuse these visit and form names EXACTLY when this part refers to the same thing, so results merge cleanly. Only add a new visit if this part reveals a genuinely new SOA timepoint:\n${skeleton}\n\n` +
    `From the PART ${i + 1} text below, return the study JSON: add any NEW visits/forms/fields found here and ENRICH existing forms with the fields/rules this part describes (prefer attaching forms to existing visit names over creating duplicates). Capture study metadata, eligibility, and findings whenever this part contains them. Be concise — keep this single response well within the output limit; remaining detail will come from other parts.\n\n` +
    `===== PART ${i + 1} TEXT =====\n${chunks[i]}`;

  let acc = await callModel(systemPrompt, buildPrompt(0, '(nothing extracted yet)'));
  const skeleton = skeletonSummary(acc);

  const rest = await Promise.all(
    chunks.slice(1).map((_, idx) => callModel(systemPrompt, buildPrompt(idx + 1, skeleton)))
  );
  for (const partial of rest) acc = mergeRawStudies(acc, partial);

  return normalizeStudy(acc, documents);
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