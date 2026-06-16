// Structured eSource study model — the keystone data structure.
// Study → visits/logs → forms → fields, plus eligibility, findings, and review trail.

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'integer'
  | 'decimal'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'yesno'
  | 'signature'
  | 'file'
  | 'calculated';

export type Confidence = 'high' | 'medium' | 'low';

export type ReviewStatus = 'pending' | 'accepted' | 'rejected';

// A single data-capture field inside a form.
export interface StudyField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  /** AI confidence in this field. Low → flagged for human review. */
  confidence: Confidence;
  /** Plain instruction for site staff on how to complete the field. */
  completionGuidance?: string;
  /** Optional section grouping within the form (e.g. "Anthropometry"). */
  section?: string;
  /** Calculation expression for type "calculated" (e.g. "weight / (height/100)^2"). */
  expression?: string;
  // ---- Traceability ----
  /** Source document this field was derived from. */
  source?: string;
  /** Protocol section reference, e.g. "§6.1". */
  protocolSection?: string;
  /** Page number in the source document, if known. */
  page?: number;
  /** Short verbatim snippet of the source text this field derives from. */
  originalText?: string;
  /** Human review decision. */
  reviewStatus: ReviewStatus;
}

// A suggested data-quality / edit-check rule on a form.
export interface ValidationRule {
  id: string;
  description: string;
  /** e.g. "range", "required-if", "cross-field" */
  ruleType: string;
  confidence: Confidence;
  /** accept/reject decision; null = undecided */
  accepted: boolean | null;
}

// A form (CRF) inside a visit or log.
export interface StudyForm {
  id: string;
  name: string;
  description?: string;
  /** If a standard template was applied (AE log, ConMed, vitals, med history). */
  appliedTemplate?: string | null;
  fields: StudyField[];
  rules: ValidationRule[];
}

// A visit or log in the study schedule.
export interface StudyVisit {
  id: string;
  name: string;
  /** "visit" = scheduled timepoint, "log" = unscheduled/continuous log */
  kind: 'visit' | 'log';
  /** e.g. "Day 1", "Week 4 (±3 days)" */
  timing?: string;
  /** e.g. "−3 to +3 days" */
  window?: string;
  forms: StudyForm[];
}

// An inclusion/exclusion criterion turned into pass/fail logic.
export interface EligibilityCriterion {
  id: string;
  kind: 'inclusion' | 'exclusion';
  /** Original criterion text from the protocol. */
  criterion: string;
  /** Suggested pass/fail logic in plain language. */
  logic: string;
  confidence: Confidence;
}

export type FindingSeverity = 'info' | 'warning' | 'blocker';

// A protocol-aware intelligence finding (cross-document issue).
export interface IntelligenceFinding {
  id: string;
  title: string;
  description: string;
  /** Where the issue was detected, e.g. "Protocol §6.1 vs. Schedule of Assessments". */
  source: string;
  confidence: Confidence;
  severity: FindingSeverity;
  /** Suggested action: "review" or "block". */
  suggestedAction: 'review' | 'block';
  resolved: boolean;
}

// A document ingested into the build.
export interface IngestedDocument {
  name: string;
  /** Detected/declared document role. */
  docType: string;
  sizeBytes: number;
}

// The complete structured study the AI produces and the reviewer approves.
export interface StudyModel {
  studyTitle: string;
  studyDescription: string;
  protocolNumber?: string;
  sponsor?: string;
  phase?: string;
  indication?: string;
  objectives?: string;
  documents: IngestedDocument[];
  visits: StudyVisit[];
  eligibility: EligibilityCriterion[];
  findings: IntelligenceFinding[];
}
