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

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const OPENAI_MODEL = (import.meta.env.VITE_OPENAI_MODEL as string) || 'gpt-4o';

export const isConfigured = !!OPENAI_KEY;

export async function generateFormFromProtocol(
  protocolText: string
): Promise<GeneratedForm> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Please analyze this research protocol and generate a comprehensive data collection form:\n\n${protocolText.slice(0, 12000)}`,
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
