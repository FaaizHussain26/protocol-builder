export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'yesno';

export interface FormQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}

export interface FormSection {
  sectionTitle: string;
  questions: FormQuestion[];
}

export interface GeneratedForm {
  formTitle: string;
  formDescription: string;
  sections: FormSection[];
}

export type FormAnswers = Record<string, string | string[]>;
