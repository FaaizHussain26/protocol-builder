// Backend API client. Replaces the former direct browser→Azure OpenAI calls:
// the Azure key now lives only on the server. Base URL via VITE_API_BASE_URL.
import type {
  StudyModel,
  StudyField,
  ValidationRule,
  IngestedDocument,
  StudySummary,
  TemplatePreferences,
  TemplateQuestion,
  Subject,
  SubjectStatus,
  VisitInstance,
  VisitInstanceStatus,
  FormSubmission,
} from '../types/study';
import { getToken, reportUnauthorized, type AuthUser } from './authToken';

export interface BuildOptions {
  /** Free-text extra instructions appended to the build prompt. */
  customInstructions?: string;
  /** Approximate number of visits/logs to model. */
  visitCount?: number;
  detailLevel?: 'concise' | 'standard' | 'detailed';
  /** Template to apply at build time. Phase 2. */
  templateId?: string;
}

export const DEFAULT_OPTIONS: Required<Omit<BuildOptions, 'customInstructions' | 'templateId'>> & {
  customInstructions: string;
  templateId?: string;
} = {
  customInstructions: '',
  visitCount: 30,
  detailLevel: 'detailed',
};

const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string) || '').replace(/\/+$/, '');

export const isConfigured = !!API_BASE;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// fetch wrapper: JSON in/out, error→Error(message), retry on 429/503 backoff.
// Attaches the logged-in user's token to every call; a 401 clears the session
// (via reportUnauthorized) so the app falls back to the login screen.
async function req<T>(path: string, init?: RequestInit, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok && (res.status === 429 || res.status === 503) && attempt < retries) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** attempt, 15000));
      continue;
    }
    if (res.status === 401) reportUnauthorized();
    if (!res.ok) {
      let msg = `API error ${res.status}`;
      try {
        const j = (await res.json()) as { error?: string };
        if (j?.error) msg = j.error;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }
}

// ---- Auth ----
export interface RegisterArgs { name: string; email: string; password: string; inviteCode?: string }
export async function registerUser(args: RegisterArgs): Promise<{ user: AuthUser; token: string }> {
  return req('/api/auth/register', { method: 'POST', body: JSON.stringify(args) });
}
export async function loginUser(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  return req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}
export async function fetchMe(): Promise<AuthUser> {
  const { user } = await req<{ user: AuthUser }>('/api/auth/me');
  return user;
}

// ---- Build pipeline ----
// The build runs for minutes (skeleton + many per-form enrichment calls), longer
// than a hosting proxy keeps a connection open. So the server returns a job id
// immediately and we poll for the result — each request stays short-lived.
// A live folder row streamed during the build (arm → folder → form names).
export interface BuildTreeRow { arm: string; folder: string; kind: string; forms: { name: string; fieldCount: number }[] }
export interface BuildProgress { phase?: string; progress?: number; partial?: BuildTreeRow[] }
type BuildStatus = BuildProgress & { status: 'pending' | 'done' | 'error'; study?: StudyModel; error?: string };

const BUILD_POLL_MS = 3000;
const BUILD_MAX_WAIT_MS = 20 * 60 * 1000; // give up after 20 minutes
const BUILD_MAX_POLL_FAILS = 6; // tolerate transient status-poll failures

// Poll a study-producing job (build or review) to completion, streaming progress.
async function pollStudyJob(jobId: string, label: string, onProgress?: (p: BuildProgress) => void): Promise<StudyModel> {
  const start = Date.now();
  let fails = 0;
  for (;;) {
    await sleep(BUILD_POLL_MS);
    let s: BuildStatus;
    try {
      s = await req<BuildStatus>(`/api/build/status/${jobId}`, {}, 0);
      fails = 0;
    } catch (e) {
      // A transient blip on a status poll shouldn't abandon a job in progress.
      if (++fails >= BUILD_MAX_POLL_FAILS) throw e;
      continue;
    }
    onProgress?.({ phase: s.phase, progress: s.progress, partial: s.partial });
    if (s.status === 'done' && s.study) return s.study;
    if (s.status === 'error') throw new Error(s.error || `${label} failed on the server.`);
    if (Date.now() - start > BUILD_MAX_WAIT_MS) throw new Error(`${label} timed out. Please try again.`);
  }
}

export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {},
  templatePreferences?: TemplatePreferences,
  onProgress?: (p: BuildProgress) => void,
  /** Receives the build job id — hand it to reviewStudyForms so the follow-up
   *  testing pass can reuse the study + corpus the server already holds. */
  onJobId?: (id: string) => void,
): Promise<StudyModel> {
  const { jobId } = await req<{ jobId: string }>('/api/build', {
    method: 'POST',
    body: JSON.stringify({ protocolText, documents, options, templatePreferences }),
  });
  onJobId?.(jobId);
  return pollStudyJob(jobId, 'Build', onProgress);
}

// Second pass: the AI re-checks every generated form against the eCRF/Protocol and
// repairs what the build missed. Normally carries just the completed build's job id
// (the server still holds its study + corpus); pass study/protocolText only when
// that job may have expired.
export async function reviewStudyForms(
  args: { buildJobId?: string; study?: StudyModel; protocolText?: string },
  onProgress?: (p: BuildProgress) => void,
): Promise<StudyModel> {
  const { jobId } = await req<{ jobId: string }>('/api/build/review', {
    method: 'POST',
    body: JSON.stringify(args),
  });
  return pollStudyJob(jobId, 'Form testing', onProgress);
}

export interface RegenerateFormArgs {
  formName: string;
  formDescription?: string;
  studyTitle?: string;
  indication?: string;
  protocolText?: string;
  prompt?: string;
  options?: BuildOptions;
}

type RegenResult = { fields: StudyField[]; rules: ValidationRule[] };
type RegenStatus = { status: 'pending' | 'done' | 'error'; result?: RegenResult; error?: string };

export async function regenerateForm(args: RegenerateFormArgs): Promise<RegenResult> {
  // Same async-job pattern as the build: a regenerate makes a full enrichment
  // call that can outlast the hosting proxy timeout, so poll instead.
  const { jobId } = await req<{ jobId: string }>('/api/build/regenerate', {
    method: 'POST',
    body: JSON.stringify(args),
  });

  const start = Date.now();
  let fails = 0;
  for (;;) {
    await sleep(BUILD_POLL_MS);
    let s: RegenStatus;
    try {
      s = await req<RegenStatus>(`/api/build/status/${jobId}`, {}, 0);
      fails = 0;
    } catch (e) {
      if (++fails >= BUILD_MAX_POLL_FAILS) throw e;
      continue;
    }
    if (s.status === 'done' && s.result) return s.result;
    if (s.status === 'error') throw new Error(s.error || 'Regenerate failed on the server.');
    if (Date.now() - start > BUILD_MAX_WAIT_MS) throw new Error('Regenerate timed out. Please try again.');
  }
}

// ---- Persistence (single shared workspace) ----
export async function listStudies(): Promise<StudySummary[]> {
  const { items } = await req<{ items: StudySummary[] }>('/api/studies');
  return items;
}

export async function getStudy(id: string): Promise<StudyModel> {
  const { study } = await req<{ study: StudyModel }>(`/api/studies/${id}`);
  return study;
}

export async function saveStudy(study: StudyModel, id?: string): Promise<StudyModel> {
  const path = id ? `/api/studies/${id}` : '/api/studies';
  const { study: saved } = await req<{ study: StudyModel }>(path, {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify({ study }),
  });
  return saved;
}

// Soft delete — moves the study to Trash (recoverable).
export async function deleteStudy(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/studies/${id}`, { method: 'DELETE' });
}

// ---- Trash ----
export async function listTrash(): Promise<StudySummary[]> {
  const { items } = await req<{ items: StudySummary[] }>('/api/studies/trash');
  return items;
}

export async function restoreStudy(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/studies/${id}/restore`, { method: 'POST' });
}

export async function permanentlyDeleteStudy(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/studies/${id}/permanent`, { method: 'DELETE' });
}

// ---- Custom "Plan Mode" questions ----
export async function listQuestions(): Promise<TemplateQuestion[]> {
  const { items } = await req<{ items: TemplateQuestion[] }>('/api/questions');
  return items;
}

export async function createQuestion(q: { text: string; answerType: string; options?: string[] }): Promise<TemplateQuestion> {
  const { question } = await req<{ question: TemplateQuestion }>('/api/questions', { method: 'POST', body: JSON.stringify(q) });
  return question;
}

export async function deleteQuestion(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/questions/${id}`, { method: 'DELETE' });
}

// ---- Data capture (Phase 2): subjects, visit instances, form submissions ----

export async function listSubjects(studyId: string): Promise<Subject[]> {
  const { items } = await req<{ items: Subject[] }>(`/api/studies/${studyId}/subjects`);
  return items;
}

export async function createSubject(studyId: string, subjectCode: string): Promise<Subject> {
  const { subject } = await req<{ subject: Subject }>(`/api/studies/${studyId}/subjects`, {
    method: 'POST',
    body: JSON.stringify({ subjectCode }),
  });
  return subject;
}

export async function getSubject(id: string): Promise<Subject> {
  const { subject } = await req<{ subject: Subject }>(`/api/subjects/${id}`);
  return subject;
}

export async function updateSubject(id: string, status: SubjectStatus): Promise<Subject> {
  const { subject } = await req<{ subject: Subject }>(`/api/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return subject;
}

export async function listVisitInstances(subjectId: string): Promise<VisitInstance[]> {
  const { items } = await req<{ items: VisitInstance[] }>(`/api/subjects/${subjectId}/visits`);
  return items;
}

export async function createVisitInstance(subjectId: string, visitId: string): Promise<VisitInstance> {
  const { visit } = await req<{ visit: VisitInstance }>(`/api/subjects/${subjectId}/visits`, {
    method: 'POST',
    body: JSON.stringify({ visitId }),
  });
  return visit;
}

export async function updateVisitInstance(
  visitInstanceId: string,
  updates: Partial<{ status: VisitInstanceStatus; scheduledDate: string; completedDate: string }>,
): Promise<VisitInstance> {
  const { visit } = await req<{ visit: VisitInstance }>(`/api/visits/${visitInstanceId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return visit;
}

// Fetches (or, on first access, creates) the submission for this visit+form.
export async function getFormSubmission(visitInstanceId: string, formId: string): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/visits/${visitInstanceId}/forms/${formId}`);
  return submission;
}

// Add a new row (repeatable forms only).
export async function addRecord(submissionId: string): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/submissions/${submissionId}/records`, { method: 'POST' });
  return submission;
}

export async function deleteRecord(submissionId: string, recordId: string): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/submissions/${submissionId}/records/${recordId}`, { method: 'DELETE' });
  return submission;
}

// Autosave — merges the given field values into the record.
export async function updateRecordValues(submissionId: string, recordId: string, values: Record<string, unknown>): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/submissions/${submissionId}/records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ values }),
  });
  return submission;
}

export async function submitRecord(submissionId: string, recordId: string): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/submissions/${submissionId}/records/${recordId}/submit`, { method: 'POST' });
  return submission;
}

export async function signRecord(submissionId: string, recordId: string): Promise<FormSubmission> {
  const { submission } = await req<{ submission: FormSubmission }>(`/api/submissions/${submissionId}/records/${recordId}/sign`, { method: 'POST' });
  return submission;
}
