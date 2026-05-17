import { useState } from 'react';
import { Download, RotateCcw, CheckCircle, ChevronDown } from 'lucide-react';
import type { GeneratedForm, FormAnswers, FormQuestion } from '../types/form';
import { generateFormPDF } from '../utils/generatePDF';

interface FormPreviewProps {
  form: GeneratedForm;
  onReset: () => void;
}

export default function FormPreview({ form, onReset }: FormPreviewProps) {
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [submitted, setSubmitted] = useState(false);

  const setAnswer = (id: string, value: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  const toggleCheckbox = (id: string, option: string) => {
    const current = (answers[id] as string[]) ?? [];
    const updated = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    setAnswer(id, updated);
  };

  const totalQuestions = form.sections.reduce((acc, s) => acc + s.questions.length, 0);
  const answered = Object.keys(answers).filter(k => {
    const v = answers[k];
    return Array.isArray(v) ? v.length > 0 : v !== '';
  }).length;
  const progress = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

  const handleDownload = () => generateFormPDF(form, answers);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Form header card */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        borderRadius: '20px 20px 0 0',
        padding: '32px 36px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 180, height: 180, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: '40%',
          width: 120, height: 120, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: -0.5 }}>
          {form.formTitle}
        </h1>
        <p style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5, maxWidth: 600 }}>
          {form.formDescription}
        </p>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', borderRadius: 8, height: 8 }}>
            <div style={{
              height: '100%', borderRadius: 8,
              background: '#fff',
              width: `${progress}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {answered}/{totalQuestions} answered
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        background: '#fff', padding: '14px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {form.sections.length} sections · {totalQuestions} questions
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onReset}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#f8fafc',
              cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#475569',
            }}
          >
            <RotateCcw size={14} /> New Protocol
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 8,
              border: 'none', background: '#2563eb',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff',
              boxShadow: '0 2px 6px rgba(37,99,235,0.35)',
            }}
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Sections */}
      <form onSubmit={handleSubmit}>
        {form.sections.map((section, si) => (
          <div key={si} style={{ background: '#fff', marginBottom: 2 }}>
            {/* Section title */}
            <div style={{
              padding: '16px 36px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              borderTop: si > 0 ? '4px solid #f1f5f9' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: '#dbeafe', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#2563eb',
                }}>
                  {si + 1}
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', letterSpacing: -0.2 }}>
                  {section.sectionTitle}
                </h2>
              </div>
            </div>

            {/* Questions */}
            <div style={{ padding: '8px 0' }}>
              {section.questions.map((q, qi) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  questionNumber={form.sections.slice(0, si).reduce((a, s) => a + s.questions.length, 0) + qi + 1}
                  answer={answers[q.id]}
                  onChange={setAnswer}
                  onToggleCheckbox={toggleCheckbox}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Submit */}
        <div style={{
          background: '#fff', padding: '24px 36px',
          borderTop: '4px solid #f1f5f9',
          display: 'flex', justifyContent: 'flex-end', gap: 12,
          borderRadius: '0 0 20px 20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}>
          {submitted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              color: '#16a34a', fontSize: 14, fontWeight: 500,
            }}>
              <CheckCircle size={18} /> Form saved successfully!
            </div>
          )}
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '11px 22px', borderRadius: 10,
              border: '1.5px solid #2563eb', background: 'transparent',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#2563eb',
            }}
          >
            <Download size={15} /> Download PDF
          </button>
          <button
            type="submit"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '11px 28px', borderRadius: 10,
              border: 'none', background: '#2563eb',
              cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#fff',
              boxShadow: '0 3px 10px rgba(37,99,235,0.4)',
            }}
          >
            Save Responses
          </button>
        </div>
      </form>
    </div>
  );
}

interface QuestionFieldProps {
  question: FormQuestion;
  questionNumber: number;
  answer: string | string[] | undefined;
  onChange: (id: string, value: string | string[]) => void;
  onToggleCheckbox: (id: string, option: string) => void;
}

function QuestionField({ question: q, questionNumber, answer, onChange, onToggleCheckbox }: QuestionFieldProps) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    border: '1.5px solid #e2e8f0', background: '#f8fafc',
    fontSize: 14, color: '#1e293b', outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{
      padding: '20px 36px',
      borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{
          minWidth: 26, height: 26, borderRadius: 6,
          background: answer && (Array.isArray(answer) ? answer.length > 0 : answer !== '')
            ? '#dcfce7' : '#f1f5f9',
          color: answer && (Array.isArray(answer) ? answer.length > 0 : answer !== '')
            ? '#16a34a' : '#94a3b8',
          fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 2, transition: 'all 0.2s',
        }}>
          {questionNumber}
        </span>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.5 }}>
            {q.question}
            {q.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
          </label>
          {q.helpText && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{q.helpText}</p>
          )}
        </div>
      </div>

      <div style={{ marginLeft: 38 }}>
        {(q.type === 'yesno') && (
          <div style={{ display: 'flex', gap: 10 }}>
            {['Yes', 'No'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(q.id, opt)}
                style={{
                  padding: '8px 24px', borderRadius: 8,
                  border: `1.5px solid ${answer === opt ? '#2563eb' : '#e2e8f0'}`,
                  background: answer === opt ? '#eff6ff' : '#f8fafc',
                  color: answer === opt ? '#2563eb' : '#475569',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {q.type === 'radio' && q.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map(opt => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${answer === opt ? '#2563eb' : '#cbd5e1'}`,
                  background: answer === opt ? '#2563eb' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}>
                  {answer === opt && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <input type="radio" name={q.id} value={opt} checked={answer === opt} onChange={() => onChange(q.id, opt)} style={{ display: 'none' }} />
                <span style={{ fontSize: 14, color: '#334155' }}>{opt}</span>
              </label>
            ))}
          </div>
        )}

        {q.type === 'checkbox' && q.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map(opt => {
              const checked = Array.isArray(answer) && answer.includes(opt);
              return (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div
                    onClick={() => onToggleCheckbox(q.id, opt)}
                    style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: `2px solid ${checked ? '#2563eb' : '#cbd5e1'}`,
                      background: checked ? '#2563eb' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {checked && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 14, color: '#334155' }}>{opt}</span>
                </label>
              );
            })}
          </div>
        )}

        {q.type === 'select' && q.options && (
          <div style={{ position: 'relative' }}>
            <select
              value={(answer as string) ?? ''}
              onChange={e => onChange(q.id, e.target.value)}
              style={{ ...inputStyle, appearance: 'none', paddingRight: 36, cursor: 'pointer' }}
            >
              <option value="">{q.placeholder ?? 'Select an option...'}</option>
              {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown size={16} color="#94a3b8" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        )}

        {q.type === 'textarea' && (
          <textarea
            value={(answer as string) ?? ''}
            onChange={e => onChange(q.id, e.target.value)}
            placeholder={q.placeholder ?? 'Enter your response...'}
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
          />
        )}

        {(q.type === 'text' || q.type === 'number' || q.type === 'date') && (
          <input
            type={q.type}
            value={(answer as string) ?? ''}
            onChange={e => onChange(q.id, e.target.value)}
            placeholder={q.placeholder ?? (q.type === 'date' ? '' : 'Enter your answer...')}
            style={inputStyle}
          />
        )}
      </div>
    </div>
  );
}
