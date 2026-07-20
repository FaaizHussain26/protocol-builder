// Backend API client. Replaces the former direct browser→Azure OpenAI calls:
// the Azure key now lives only on the server. Base URL via VITE_API_BASE_URL.
import type {
  StudyModel,
  StudyField,
  ValidationRule,
  IngestedDocument,
  StudySummary,
  Template,
  TemplatePreferences,
  TemplateQuestion,
  EsourceAnalysis,
} from '../types/study';

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
async function req<T>(path: string, init?: RequestInit, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok && (res.status === 429 || res.status === 503) && attempt < retries) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(1000 * 2 ** attempt, 15000));
      continue;
    }
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

// ---- Build pipeline ----
// The build runs for minutes (skeleton + many per-form enrichment calls), longer
// than a hosting proxy keeps a connection open. So the server returns a job id
// immediately and we poll for the result — each request stays short-lived.
type BuildStatus = { status: 'pending' | 'done' | 'error'; study?: StudyModel; error?: string };

const BUILD_POLL_MS = 3000;
const BUILD_MAX_WAIT_MS = 20 * 60 * 1000; // give up after 20 minutes
const BUILD_MAX_POLL_FAILS = 6; // tolerate transient status-poll failures

export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {},
  templatePreferences?: TemplatePreferences,
): Promise<StudyModel> {
  const { jobId } = await req<{ jobId: string }>('/api/build', {
    method: 'POST',
    body: JSON.stringify({ protocolText, documents, options, templatePreferences }),
  });

  const start = Date.now();
  let fails = 0;
  for (;;) {
    await sleep(BUILD_POLL_MS);
    let s: BuildStatus;
    try {
      s = await req<BuildStatus>(`/api/build/status/${jobId}`, {}, 0);
      fails = 0;
    } catch (e) {
      // A transient blip on a status poll shouldn't abandon a build in progress.
      if (++fails >= BUILD_MAX_POLL_FAILS) throw e;
      continue;
    }
    if (s.status === 'done' && s.study) return s.study;
    if (s.status === 'error') throw new Error(s.error || 'Build failed on the server.');
    if (Date.now() - start > BUILD_MAX_WAIT_MS) throw new Error('Build timed out. Please try again.');
  }
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

export async function deleteStudy(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/studies/${id}`, { method: 'DELETE' });
}

// ---- Templates ----
export async function listTemplates(): Promise<Template[]> {
  const { items } = await req<{ items: Template[] }>('/api/templates');
  return items;
}

export async function createTemplate(t: Omit<Template, 'id'>): Promise<Template> {
  const { template } = await req<{ template: Template }>('/api/templates', { method: 'POST', body: JSON.stringify(t) });
  return template;
}

export async function updateTemplate(id: string, t: Omit<Template, 'id'>): Promise<Template> {
  const { template } = await req<{ template: Template }>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(t) });
  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await req<{ ok: boolean }>(`/api/templates/${id}`, { method: 'DELETE' });
}

// ---- eSource → template analysis ----
// Same async-job pattern as the build: POST returns a jobId, then poll.
type AnalyzeStatus = { status: 'pending' | 'done' | 'error'; analysis?: EsourceAnalysis; error?: string };

const ANALYZE_POLL_MS = 2500;
const ANALYZE_MAX_WAIT_MS = 10 * 60 * 1000;

export async function analyzeEsource(esourceText: string, fileName?: string): Promise<EsourceAnalysis> {
  const { jobId } = await req<{ jobId: string }>('/api/templates/analyze', {
    method: 'POST',
    body: JSON.stringify({ esourceText, fileName }),
  });

  const start = Date.now();
  let fails = 0;
  for (;;) {
    await sleep(ANALYZE_POLL_MS);
    let s: AnalyzeStatus;
    try {
      s = await req<AnalyzeStatus>(`/api/templates/analyze/status/${jobId}`, {}, 0);
      fails = 0;
    } catch (e) {
      if (++fails >= BUILD_MAX_POLL_FAILS) throw e;
      continue;
    }
    if (s.status === 'done' && s.analysis) return s.analysis;
    if (s.status === 'error') throw new Error(s.error || 'eSource analysis failed on the server.');
    if (Date.now() - start > ANALYZE_MAX_WAIT_MS) throw new Error('eSource analysis timed out. Please try again.');
  }
}

// ---- Custom "Plan Mode" questions (persist across template creations) ----
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
