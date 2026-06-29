import type { TemplateQuestion } from '../types/study';
import { UNIVERSAL_QUESTIONS } from './universalRules';

// Static "Plan Mode" questions every site/company starts from.
const STD = 'Standard eSource (Visit)';
const PREF = 'Client preferences (Visit)';

export const STANDARD_VISIT_QUESTIONS: TemplateQuestion[] = [
  { id: 'std-visit-performed', text: 'Was the visit performed?', answerType: 'yesno', group: STD },
  { id: 'std-visit-date', text: 'Visit date', answerType: 'date', group: STD },
  { id: 'std-visit-type', text: 'Visit type', answerType: 'dropdown', options: ['Screening', 'Baseline', 'Treatment', 'Follow-up', 'Unscheduled', 'End of Study'], group: STD },
  { id: 'std-subject-attended', text: 'Subject attended visit?', answerType: 'yesno', group: STD },
  { id: 'std-visit-completed', text: 'Visit completed?', answerType: 'yesno', group: STD },
  { id: 'std-per-protocol', text: 'Visit conducted per protocol?', answerType: 'yesno', group: STD },
  { id: 'std-within-window', text: 'Was the visit within the window?', answerType: 'yesno', group: STD },
  { id: 'std-unscheduled', text: 'Was the visit unscheduled?', answerType: 'yesno', group: STD },
  { id: 'std-start-time', text: 'Start time', answerType: 'time', group: STD },
  { id: 'std-end-time', text: 'End time', answerType: 'time', group: STD },
  { id: 'std-missed', text: 'Missed visit?', answerType: 'yesno', group: STD },
  { id: 'std-missed-reason', text: 'Reason for missed visit', answerType: 'textarea', group: STD },
];

export const PREFERENCE_VISIT_QUESTIONS: TemplateQuestion[] = [
  { id: 'pref-televisit', text: 'Televisit allowed?', answerType: 'preference', group: PREF },
  { id: 'pref-exact-duration', text: 'Require exact visit duration?', answerType: 'preference', group: PREF },
  { id: 'pref-auto-window', text: 'Auto-calculate the visit window as per protocol?', answerType: 'preference', group: PREF },
  { id: 'pref-crc-esign', text: 'Electronic signature required for CRC?', answerType: 'preference', group: PREF },
  { id: 'pref-auto-deviations', text: 'Auto-create protocol deviations?', answerType: 'preference', group: PREF },
  { id: 'pref-completion-checklist', text: 'Visit completion checklist?', answerType: 'preference', group: PREF },
  { id: 'pref-subject-docs', text: 'Subject documents completion checklist (HIPAA, DL, …)?', answerType: 'preference', group: PREF },
  { id: 'pref-reschedule', text: 'Allow visit rescheduling / unscheduling?', answerType: 'preference', group: PREF },
];

// Universal eSource rules from "Universal Rules across all the sites" — grouped
// Yes/No questions fed into the build prompt (the server also applies these per
// form by default; selecting/answering here lets a template override them).
export { UNIVERSAL_QUESTIONS } from './universalRules';

export const PREDEFINED_QUESTIONS: TemplateQuestion[] = [
  ...STANDARD_VISIT_QUESTIONS,
  ...PREFERENCE_VISIT_QUESTIONS,
  ...UNIVERSAL_QUESTIONS,
];
