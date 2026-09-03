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
  /** Optional display-format hint (e.g. date segment order). Phase 2. */
  format?: string;
  /** Protocol/SOA footnote or extra site note shown under the field. */
  footnote?: string;
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
  /** True once the user hand-edited this field after generation. */
  editedByUser?: boolean;
  /** Snapshot of the AI-generated version taken on the FIRST user edit —
   *  the (original, edited) pair feeds the preference-learning memory. */
  aiOriginal?: FieldSnapshot;
  /** Field-level alert shown to site staff / carried into the build. */
  alert?: FieldAlert;
  /** Conditional display/requirement driven by another field in the form. */
  condition?: FieldCondition;
}

// An alert attached directly to a field (edited from the field drawer).
export interface FieldAlert {
  level: 'info' | 'warning' | 'critical';
  message: string;
}

// Conditional logic on a field: when a controlling field meets the condition,
// this field is shown (or becomes required).
export interface FieldCondition {
  /** Id of the controlling field in the same form. */
  whenFieldId?: string;
  operator: 'equals' | 'not-equals' | 'is-empty' | 'is-not-empty';
  /** Comparison value (unused for is-empty / is-not-empty). */
  value?: string;
  /** What happens when the condition is met. */
  action: 'show' | 'require';
}

/** The learnable aspects of a field, captured before the user's first edit. */
export interface FieldSnapshot {
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  completionGuidance?: string;
  section?: string;
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
  /** Free-text header/instructions shown at the top of the form. */
  header?: string;
  /** If a standard template was applied (AE log, ConMed, vitals, med history). */
  appliedTemplate?: string | null;
  /** Per-form prompt used to (re)generate this form during review. */
  prompt?: string;
  /** Repeatable log/table — the site can add multiple records (rows) at data entry. */
  repeatable?: boolean;
  fields: StudyField[];
  rules: ValidationRule[];
  /** Alerts/notifications configured on this form (Phase 2). */
  alerts?: FormAlert[];
}

// A flag/notification rule on a form or a specific field.
export interface FormAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  /** Plain-language condition that raises the alert. */
  trigger?: string;
  /** Optional field this alert is attached to. */
  fieldId?: string;
}

// A visit or log in the study schedule.
// A study "arm" — the top-level folder grouping a set of visits belong to.
export type StudyArm =
  | 'General'
  | 'Study Visit'
  | 'Unscheduled Visit'
  | 'SAE'
  | 'Early Termination'
  | 'Reconsent';

export interface StudyVisit {
  id: string;
  name: string;
  /** "visit" = scheduled timepoint, "log" = unscheduled/continuous log */
  kind: 'visit' | 'log';
  /** e.g. "Day 1", "Week 4 (±3 days)" */
  timing?: string;
  /** e.g. "−3 to +3 days" */
  window?: string;
  /** Top-level arm (main folder) this visit belongs to — a StudyArm or any
   *  custom arm name the user creates. Defaults to 'Study Visit'. */
  arm?: string;
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
  /** Persistence id (set once saved to the backend). */
  id?: string;
  /** Review lifecycle: "draft" until every field is approved, then "final". */
  status?: 'draft' | 'reviewed' | 'final';
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
  /** When the eSource was first saved (ISO) — set by the server, read-only. */
  createdAt?: string;
  /** Who created / last saved the study — set by the server, read-only. */
  createdBy?: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  /** Applied template and date-format preference. Phase 2. */
  templateId?: string;
  dateFormatPreference?: string;
  /** Persist the Plan Mode "input-type badge" choice for this study. */
  showFieldTypeBadge?: boolean;
}

// ---- Data capture (Phase 2): real subject data entered against a study's forms ----

export type SubjectStatus = 'enrolled' | 'screen-failed' | 'completed' | 'withdrawn';

export interface Subject {
  id: string;
  studyId: string;
  subjectCode: string;
  status: SubjectStatus;
  enrolledAt: string;
  createdBy?: { id: string; name: string };
  /** Present when fetched via getSubject — that subject's visit instances. */
  visits?: VisitInstance[];
}

export type VisitInstanceStatus = 'scheduled' | 'completed' | 'missed';

export interface VisitInstance {
  id: string;
  studyId: string;
  subjectId: string;
  /** The StudyVisit.id this instance is an occurrence of. */
  visitId: string;
  /** Snapshotted from StudyVisit at creation. */
  visitName: string;
  arm?: string;
  status: VisitInstanceStatus;
  scheduledDate?: string;
  completedDate?: string;
  createdBy?: { id: string; name: string };
}

export type RecordStatus = 'in-progress' | 'submitted' | 'signed';

export interface SubmissionRecord {
  id: string;
  values: Record<string, unknown>;
  status: RecordStatus;
  submittedBy?: { id: string; name: string };
  submittedAt?: string;
  signedBy?: { id: string; name: string };
  signedAt?: string;
}

export interface FormSubmission {
  id: string;
  studyId: string;
  subjectId: string;
  visitInstanceId: string;
  formId: string;
  /** Snapshotted from StudyForm at creation. */
  formName: string;
  repeatable: boolean;
  records: SubmissionRecord[];
}

// ---- Templates: reusable form preferences applied at build time (Phase 2) ----
export type DateSegment = 'D' | 'M' | 'Y';

export interface TemplatePreferences {
  /** Date format token string, e.g. "YYYY-MM-DD", "DD-MMM-YYYY", "YY". Preferred. */
  dateFormat?: string;
  /** Legacy segment order, e.g. ['M','Y','D']. Used as a fallback. */
  dateOrder?: DateSegment[];
  /** Legacy separator between date segments. */
  dateSeparator?: string;
  timeFormat: '12h' | '24h';
  /** Ensure a signature field on consent/completion forms. */
  requireSignature: boolean;
  /** Allow document-upload (file) fields. */
  documentUploadFields: boolean;
  /** Inject the General Sections log (Medical History, Allergies, …). */
  generalSections: boolean;
  /** Order Screening visits chronologically with the canonical form sequence. */
  screeningOrder: boolean;
  /** Default alerts seeded onto generated forms. */
  alertDefaults?: FormAlert[];
  /** Free-text instructions injected directly into the build prompt. */
  instructions?: string;
  /** Plan-mode questions selected to feed the build prompt. */
  questions?: TemplateQuestion[];
  /** Emit per-field completion guidance (descriptions). */
  fieldDescriptions?: boolean;
  /** How much completion-guidance text to generate when fieldDescriptions is on. */
  fieldDescriptionDetail?: 'high' | 'medium' | 'low';
  /** Emit per-field footnotes. */
  fieldFootnotes?: boolean;
  /** How much footnote text to generate when fieldFootnotes is on. */
  fieldFootnoteDetail?: 'high' | 'medium' | 'low';
  /** Show the input-type badge under each field (display-only). */
  showFieldTypeBadge?: boolean;
}

// A selectable "Plan Mode" question fed into the build prompt.
export type QuestionAnswerType =
  | 'yesno'
  | 'date'
  | 'time'
  | 'dropdown'
  | 'text'
  | 'textarea'
  | 'number'
  | 'preference';

export interface TemplateQuestion {
  /** Stable id — a slug for predefined questions, a DB id for custom ones. */
  id: string;
  text: string;
  answerType: QuestionAnswerType;
  /** Grouping label, e.g. "Standard eSource (Visit)", "Client preferences (Visit)", "Custom". */
  group: string;
  /** Options for dropdown answers. */
  options?: string[];
  /** True when user-created (persisted to the question library). */
  custom?: boolean;
  /** Yes/No answer for boolean rule-style questions. Defaults to "yes". */
  answer?: 'yes' | 'no';
  /** AI confidence when the question was detected from an uploaded eSource. */
  confidence?: Confidence;
}

// ---- eSource → template analysis (upload an existing eSource, detect prefs) ----

/** A field the AI would generate, previewed from an uploaded eSource. */
export interface DetectedField {
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  section?: string;
  confidence: Confidence;
}

export interface DetectedForm {
  name: string;
  fields: DetectedField[];
}

/** Result of analyzing an uploaded eSource document for template creation. */
export interface EsourceAnalysis {
  /** Suggested template name (from the study/document). */
  templateName: string;
  summary: string;
  /** Core preference toggles detected from the document (undefined = not determinable). */
  preferences: Partial<Pick<TemplatePreferences,
    'dateFormat' | 'timeFormat' | 'requireSignature' | 'documentUploadFields' | 'generalSections' | 'screeningOrder'>>;
  /** Detected preference/rule statements, each with AI confidence. */
  questions: TemplateQuestion[];
  /** Universal rules the eSource contradicts (should be answered "no"). */
  ruleOverrides: { id: string; text: string; answer: 'yes' | 'no'; confidence: Confidence }[];
  /** The forms/fields the AI will generate when this template is used. */
  forms: DetectedForm[];
  /** Free-text style directives distilled from the eSource. */
  instructions?: string;
}

export interface Template {
  id?: string;
  name: string;
  description?: string;
  preferences: TemplatePreferences;
}

export const DEFAULT_PREFERENCES: TemplatePreferences = {
  dateFormat: 'DD-MMM-YYYY',
  dateOrder: ['M', 'Y', 'D'],
  dateSeparator: ' ',
  timeFormat: '24h',
  requireSignature: true,
  documentUploadFields: true,
  generalSections: true,
  screeningOrder: true,
  fieldDescriptions: true,
  fieldDescriptionDetail: 'medium',
  fieldFootnotes: true,
  fieldFootnoteDetail: 'medium',
  showFieldTypeBadge: true,
};

// Lightweight row for the saved-studies ("My Studies") list.
export interface StudySummary {
  id: string;
  studyTitle: string;
  protocolNumber?: string;
  phase?: string;
  status: string;
  /** When the eSource was first created (ISO). */
  createdAt?: string;
  updatedAt: string;
  visitCount: number;
  formCount?: number;
  fieldCount: number;
  /** Denormalized count of accepted fields — drives draft review progress. */
  approvedFieldCount?: number;
  /** Pending fields with low AI confidence — surfaced as "flagged". */
  flaggedFieldCount?: number;
  /** Unresolved blocker-severity intelligence findings. */
  openBlockerCount?: number;
  /** Set when the study is in Trash (soft-deleted). */
  deletedAt?: string;
}
