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
  visitCount: 16,
  detailLevel: 'detailed',
};

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4.1';

export const isConfigured = !!OPENAI_KEY;

const BASE_SYSTEM_PROMPT = `You are an expert clinical-trial eSource builder. You read one or more uploaded study documents (Clinical Study Protocol, Schedule of Activities/Assessments (SOA), Laboratory/Pharmacy/Imaging manuals, Questionnaires, study guidelines, sponsor references) and produce a STRUCTURED, EDITABLE eSource STUDY MODEL — visits → forms → typed fields — driven by the Schedule of Activities. This is not a flat list of questions.

Each uploaded document is delimited in the input with a header line "===== DOCUMENT: <filename> =====". Use both the filename and the content to tell the documents apart.

WORKFLOW — follow in order, do not skip a step:
1. IDENTIFY THE PRIMARY PROTOCOL. Among the uploaded documents, determine which one is the Clinical Study Protocol (the largest, most complete document — typically titled "Clinical Study Protocol" / "Protocol", containing objectives, study design, eligibility, the visit schedule, and procedure descriptions). The others (lab/pharmacy/imaging manuals, questionnaires, sponsor references) are SUPPORTING documents that add detail. Note which filename you chose as the protocol.
2. READ THE PROTOCOL COMPLETELY. From the primary protocol extract every available piece of study-level information: study title, protocol number, phase, indication/condition, sponsor, primary and secondary objectives, study design, and the full inclusion/exclusion criteria. Do not stop at the summary — mine the whole document. Protocol structure and section numbering vary between studies, so reason about meaning, not fixed headings.
3. LOCATE THE SCHEDULE OF ACTIVITIES (SOA). The SOA is a TABLE inside the protocol (often called Schedule of Activities, Schedule of Assessments, Schedule of Events, Study Flow Chart, or Time and Events Table). When documents are extracted to plain text, table rows and columns are flattened and may look misaligned — reconstruct the table logically: the COLUMNS are the study visits/timepoints and the ROWS are the procedures/assessments.
4. EXTRACT EVERY STUDY VISIT from the SOA columns. Read the protocol THOROUGHLY and STRICTLY: every single column in the Schedule of Activities is a visit and MUST appear in the output — do not collapse, summarize, sample, or skip intermediate timepoints. The NUMBER of visits is NOT a fixed or hardcoded value: it is determined strictly by counting the timepoint columns the protocol's SOA actually defines, so output exactly that many visits, in order. Each visit's NAME is its visit label ('Screening', 'Baseline', 'Randomization', 'End of Treatment', 'Follow-Up') or, when unlabelled, a sequential 'Visit 1', 'Visit 2', ... — never 'Week N'; the week/day timepoint goes in the "timing" field. A typical phase II/III protocol has many visits (often 8-15+); returning only a few means you have missed columns — go back to the SOA and read every column. Continuous/unscheduled collections (Adverse Events, Concomitant Medications) are kind "log".
5. IDENTIFY THE PROCEDURES MARKED IN EACH VISIT. Read each SOA cell: a marker ("X", "x", "✓", "●", "Required", "Optional", "Conditional", or similar) at the intersection of a procedure row and a visit column means that procedure is collected at that visit. An empty cell means it is NOT collected there.
6. MAP FORMS TO VISITS. Turn each marked procedure into a FORM placed under that visit. A procedure marked across multiple visits produces a form under EACH of those visits (e.g. Vital Signs collected at every visit appears under every visit).
7. SEARCH THE PROTOCOL CONTENT FOR PROCEDURE DETAILS. For each procedure/form, search the full protocol and the supporting documents for how that procedure is actually performed and recorded, and generate protocol-specific fields from that detail — never generic placeholders. (e.g. "Vital Signs" → Systolic BP, Diastolic BP, Heart Rate, Respiratory Rate, Temperature, Height, Weight, BMI; "Demographics" → Subject ID, Initials, Date of Birth, Age, Sex, Race, Ethnicity; lab panels → the individual analytes listed in the protocol or lab manual.)
8. For every field, choose the best field type, add validation rules and required flags, and record full traceability (which document, section, page, and the verbatim snippet it came from).

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
      "name": "string — the visit NAME. Use the protocol's named milestone when the SOA names it ('Screening', 'Baseline', 'Randomization', 'End of Treatment', 'Follow-Up'); otherwise number visits sequentially as 'Visit 1', 'Visit 2', 'Visit 3', .... Do NOT name a visit 'Week N' — the week/day belongs in 'timing', not the name.",
      "kind": "visit | log",
      "timing": "string — the timepoint (e.g. 'Day -28 to -1', 'Week 4', 'Day 1')",
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
- VISIT COMPLETENESS IS MANDATORY: output one visit for EVERY column the SOA defines — all of them. Do not omit, merge, or sample visits. The number of visits you output should match the number of timepoint columns in the SOA. Do not, however, fabricate visits that the SOA does not contain.
- FORMS AND FIELDS ARE MANDATORY: every visit MUST contain its forms (the procedures marked at that visit), and every form MUST contain its fields. A visit with an empty "forms" array, or a form with an empty "fields" array, is INVALID. NEVER return a bare list of visits without their forms and fields — that is a failed response. If producing all visits in full detail is long, prefer slightly fewer fields per form over dropping forms, but every visit must still carry its forms.
- VISIT NAMING: name visits by their protocol milestone when the SOA names them (Screening, Baseline, Randomization, End of Treatment, Follow-Up); otherwise number them in order ('Visit 1', 'Visit 2', ...). Never put the week/day in the visit name — it goes in "timing". A name like 'Week 12' or 'Day 8' is WRONG; use 'Visit N' and put 'Week 12'/'Day 8' in "timing".
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
  lines.push(`- The SOA defines the true set of visits/logs — extract exactly those. Treat ~${o.visitCount} only as a rough sizing hint; never invent extra weekly visits to reach a count.`);
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
      max_tokens: 32768,
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

  // A visit name that is purely a week/day timepoint (e.g. "Week 12", "Day 8",
  // "Week 4 (±3 days)"). The week/day belongs in `timing`, not the name.
  const weekDayName = /^(?:week|wk|day)\s*[-+]?\d+[a-z]?(?:\s*\([^)]*\))?\s*$/i;

  const visits: StudyVisit[] = (raw.visits ?? []).map((v, vi) => {
    const kind = v.kind === 'log' ? 'log' : 'visit';
    let name = v.name || `Visit ${vi + 1}`;
    let timing = v.timing || undefined;
    if (kind === 'visit' && weekDayName.test(name.trim())) {
      if (!timing) timing = name.trim();
      name = `Visit ${vi + 1}`;
    }
    return {
    id: v.id || `v${vi + 1}`,
    name,
    kind,
    timing,
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
    };
  });

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
