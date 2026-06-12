import type { GeneratedForm } from '../types/form';

export interface FormOptions {
  /** Free-text extra instructions appended to the system prompt. */
  customInstructions?: string;
  /** Approximate number of questions to generate. */
  questionCount?: number;
  /** Approximate number of sections to organize questions into. */
  sectionCount?: number;
  /** Who the form is for / what kind of form (e.g. "site coordinator eSource", "patient intake"). */
  formType?: string;
  /** Tone/complexity of the language. */
  detailLevel?: 'concise' | 'standard' | 'detailed';
}

export const DEFAULT_OPTIONS: Required<Omit<FormOptions, 'customInstructions'>> & { customInstructions: string } = {
  customInstructions: '',
  questionCount: 30,
  sectionCount: 6,
  formType: 'clinical research eSource data collection form',
  detailLevel: 'standard',
};

export const BASE_SYSTEM_PROMPT = `You are an expert clinical research form designer. When given one or more research protocol documents, you analyze them deeply and generate a comprehensive, structured data collection form.

Your output MUST be valid JSON matching this exact structure:
{
  "formTitle": "string",
  "formDescription": "string",
  "sections": [
    {
      "sectionTitle": "string",
      "questions": [
        {
          "id": "q1",
          "type": "text|textarea|number|date|select|radio|checkbox|yesno",
          "question": "string",
          "required": true|false,
          "options": ["option1", "option2"],
          "placeholder": "string",
          "helpText": "string"
        }
      ]
    }
  ]
}

Rules:
- Use "yesno" type for simple yes/no questions
- Use "radio" for single-choice from 2-5 options
- Use "select" for single-choice from 6+ options
- Use "checkbox" for multiple-choice questions
- Use "textarea" for long free-text responses
- Use "text" for short free-text (names, IDs, brief answers)
- Use "number" for numeric values
- Use "date" for date fields
- Only include "options" array for select/radio/checkbox types
- Make questions specific to the actual protocol content
- When multiple documents are provided, synthesize them into ONE cohesive form, de-duplicating overlapping fields
- Return ONLY the JSON object, no markdown, no explanation`;

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o';

export const isConfigured = !!OPENAI_KEY;

// Build the dynamic portion of the system prompt from user options.
export function buildSystemPrompt(options: FormOptions = {}): string {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const lines: string[] = [BASE_SYSTEM_PROMPT, '', 'Additional requirements for this form:'];

  lines.push(`- This form is a: ${o.formType}`);
  lines.push(`- Generate approximately ${o.questionCount} relevant questions`);
  lines.push(`- Organize them into approximately ${o.sectionCount} logical sections`);

  if (o.detailLevel === 'concise') {
    lines.push('- Keep question wording brief and to the point; minimal help text');
  } else if (o.detailLevel === 'detailed') {
    lines.push('- Use thorough, descriptive wording and include helpful helpText for most questions');
  } else {
    lines.push('- Use clear, professional wording with helpText where useful');
  }

  if (o.customInstructions.trim()) {
    lines.push('', 'User custom instructions (follow these closely):', o.customInstructions.trim());
  }

  return lines.join('\n');
}

export async function generateFormFromProtocol(
  protocolText: string,
  options: FormOptions = {}
): Promise<GeneratedForm> {
  const systemPrompt = buildSystemPrompt(options);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Please analyze the following research protocol document(s) and generate a comprehensive data collection form:\n\n${protocolText.slice(0, 30000)}`,
        },
      ],
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  let jsonText = data.choices[0]?.message?.content?.trim() ?? '';
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  return JSON.parse(jsonText) as GeneratedForm;
}
