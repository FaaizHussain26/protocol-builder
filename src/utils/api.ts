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
export async function buildStudyFromDocuments(
  protocolText: string,
  documents: IngestedDocument[],
  options: BuildOptions = {},
  templatePreferences?: TemplatePreferences,
): Promise<StudyModel> {
  const { study } = await req<{ study: StudyModel }>('/api/build', {
    method: 'POST',
    body: JSON.stringify({ protocolText, documents, options, templatePreferences }),
  });
  return study;
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

export async function regenerateForm(
  args: RegenerateFormArgs,
): Promise<{ fields: StudyField[]; rules: ValidationRule[] }> {
  return req<{ fields: StudyField[]; rules: ValidationRule[] }>('/api/build/regenerate', {
    method: 'POST',
    body: JSON.stringify(args),
  });
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
