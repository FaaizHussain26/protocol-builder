import type { GeneratedForm } from '../types/form';

const SYSTEM_PROMPT = `You are an expert clinical research form designer. When given a research protocol document, you analyze it deeply and generate a comprehensive, structured data collection form.

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
- Generate 20-40 relevant questions organized into 4-8 logical sections
- Make questions specific to the actual protocol content
- Return ONLY the JSON object, no markdown, no explanation`;

const AZURE_KEY = import.meta.env.VITE_AZURE_OPENAI_KEY as string;
const AZURE_ENDPOINT = (import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string).replace(/\/$/, '');
const DEPLOYMENT = (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as string) || 'gpt-4o';
const API_VERSION = '2024-08-01-preview';

export async function generateFormFromProtocol(
  protocolText: string
): Promise<GeneratedForm> {
  // Azure OpenAI REST API: POST /openai/deployments/{deployment}/chat/completions?api-version=...
  const url = `${AZURE_ENDPOINT}/openai/deployments/${DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE_KEY,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Please analyze this research protocol and generate a comprehensive data collection form:\n\n${protocolText.slice(0, 12000)}`,
        },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${errBody}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  let jsonText = data.choices[0]?.message?.content?.trim() ?? '';
  jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');

  return JSON.parse(jsonText) as GeneratedForm;
}
