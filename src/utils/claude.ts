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
  visitCount: 6,
  detailLevel: 'standard',
};

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4.1';

export const isConfigured = !!OPENAI_KEY;

const BASE_SYSTEM_PROMPT = `You are an expert clinical-trial eSource builder. You read one or more uploaded study documents (Clinical Study Protocol, Schedule of Activities/Assessments (SOA), Laboratory/Pharmacy/Imaging manuals, Questionnaires, study guidelines, sponsor references) and produce a STRUCTURED, EDITABLE eSource STUDY MODEL — visits → forms → typed fields — driven by the Schedule of Activities. This is not a flat list of questions.

WORKFLOW — follow in order:
1. Identify the PRIMARY protocol among the documents. Extract: study name, protocol number, phase, indication, sponsor, study objectives, and inclusion/exclusion criteria. Understand protocol structure even when formatting differs between studies.
2. Locate the Schedule of Activities (SOA) table.
3. Extract EVERY patient visit/timepoint from the SOA columns (e.g. Screening, Baseline, Randomization, Day 1, Visit 1/2/3/4/5/6/7/8/9/10/11/12/13/14/15/16, End of Treatment, End of Study, Follow-Up). Capture visit sequence, timing, and windows. Continuous/unscheduled logs (Adverse Events, Concomitant Medications) are kind "log".
4. Read the SOA cells: a marker ("X", "✓", "Required", "Optional", "Conditional") means that procedure/form is collected at that visit. Map each marked procedure to a FORM under that visit. A procedure marked across multiple visits produces a form under EACH of those visits.
5. For each procedure/form, SEARCH the full protocol and supporting documents for the data-collection details and generate protocol-specific fields — never generic placeholders. (e.g. "Vital Signs" → Systolic BP, Diastolic BP, Heart Rate, Respiratory Rate, Temperature, Height, Weight, BMI; "Demographics" → Subject ID, Initials, Date of Birth, Age, Sex, Race, Ethnicity.)
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
- Generate the standard clinical forms when the protocol supports them: Informed Consent, Demographics, Eligibility, Medical History, Concomitant Medications, Adverse Events, Vital Signs, Physical Examination, Laboratory Results, ECG, Imaging, Questionnaires, End of Study.
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
  lines.push(`- Model approximately ${o.visitCount} visits/logs.`);
  if (o.detailLevel === 'concise') lines.push('- Keep field counts lean (3-6 fields per form).');
  else if (o.detailLevel === 'detailed') lines.push('- Be thorough (6-12 fields per form, rich guidance).');
  else lines.push('- Use a realistic field count (4-8 fields per form).');
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

export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {}
): Promise<StudyModel> {
  const systemPrompt = buildSystemPrompt(options);

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
        {
          role: 'user',
          content: `Build a structured eSource study from the following source document(s):\n\n${protocolText.slice(0, 120000)}`,
        },
      ],
      max_tokens: 16384,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  let jsonText = data.choices[0]?.message?.content?.trim() ?? '';
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const raw = JSON.parse(jsonText) as RawStudy;

  return normalizeStudy(raw, documents);
}

// Attach review state, fill defaults, and guarantee stable IDs.
function normalizeStudy(raw: RawStudy, documents: IngestedDocument[]): StudyModel {
  let fieldSeq = 0;
  let ruleSeq = 0;

  const visits: StudyVisit[] = (raw.visits ?? []).map((v, vi) => ({
    id: v.id || `v${vi + 1}`,
    name: v.name || `Visit ${vi + 1}`,
    kind: v.kind === 'log' ? 'log' : 'visit',
    timing: v.timing || undefined,
    window: v.window || undefined,
    forms: (v.forms ?? []).map((f, fi): StudyForm => ({
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
  }));

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