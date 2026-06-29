// Deprecated: the build pipeline + prompts moved to the backend service.
// This file now re-exports the API client so any lingering imports keep working.
// The Azure OpenAI key is no longer referenced by the frontend.
export {
  buildStudyFromDocuments,
  regenerateForm,
  listStudies,
  getStudy,
  saveStudy,
  deleteStudy,
  isConfigured,
  DEFAULT_OPTIONS,
} from './api';
export type { BuildOptions, RegenerateFormArgs } from './api';
