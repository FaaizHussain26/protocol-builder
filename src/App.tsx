import { useState } from 'react';
import { Brain, Sparkles, Shield, FileOutput, AlertCircle, Loader, CheckCircle2 } from 'lucide-react';
import FileUpload from './components/FileUpload';
import FormPreview from './components/FormPreview';
import { extractTextFromFile } from './utils/extractText';
import { generateFormFromProtocol } from './utils/claude';
import type { GeneratedForm } from './types/form';

type Step = 'upload' | 'processing' | 'form';

interface ProcessingState {
  stage: 'extracting' | 'analyzing' | 'building';
  message: string;
  progress: number;
}

const AZURE_CONFIGURED = !!(
  import.meta.env.VITE_AZURE_OPENAI_KEY &&
  import.meta.env.VITE_AZURE_OPENAI_ENDPOINT
);

export default function App() {
  const [step, setStep] = useState<Step>('upload');
  const [form, setForm] = useState<GeneratedForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);

  const handleFileSelect = async (file: File) => {
    if (!AZURE_CONFIGURED) {
      setError('Azure OpenAI credentials are not configured. Check your .env file.');
      return;
    }
    setError(null);
    setStep('processing');

    try {
      setProcessing({ stage: 'extracting', message: 'Reading your protocol document...', progress: 20 });
      const text = await extractTextFromFile(file);

      if (text.trim().length < 100) {
        throw new Error('The document appears to be empty or could not be read. Please try a different file.');
      }

      setProcessing({ stage: 'analyzing', message: 'Azure AI is analyzing the protocol...', progress: 55 });
      await new Promise(r => setTimeout(r, 400));

      const generated = await generateFormFromProtocol(text);

      setProcessing({ stage: 'building', message: 'Building your form...', progress: 90 });
      await new Promise(r => setTimeout(r, 500));

      setForm(generated);
      setStep('form');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      setStep('upload');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Top Nav */}
      <nav style={{
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={18} color="#fff" />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>ProtoForm</span>
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20,
              background: '#eff6ff', color: '#2563eb',
            }}>AI</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {AZURE_CONFIGURED ? (
            <>
              <CheckCircle2 size={14} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>Azure AI Connected</span>
            </>
          ) : (
            <>
              <Shield size={14} color="#64748b" />
              <span style={{ fontSize: 12, color: '#64748b' }}>Powered by Azure OpenAI</span>
            </>
          )}
        </div>
      </nav>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        {step === 'upload' && (
          <>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: '#eff6ff', marginBottom: 16,
              }}>
                <Sparkles size={14} color="#2563eb" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                  AI-Powered Form Generation
                </span>
              </div>
              <h1 style={{ fontSize: 38, fontWeight: 800, color: '#0f172a', marginBottom: 14, letterSpacing: -1 }}>
                Turn Any Protocol into a<br />
                <span style={{ color: '#2563eb' }}>Smart Data Collection Form</span>
              </h1>
              <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.65 }}>
                Upload your research protocol and Azure AI will automatically
                generate a structured, downloadable form tailored to your specific study.
              </p>
            </div>

            {/* Feature pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 40, flexWrap: 'wrap' }}>
              {[
                { icon: <Brain size={14} />, text: 'Azure AI Analysis' },
                { icon: <FileOutput size={14} />, text: 'PDF Export' },
                { icon: <Sparkles size={14} />, text: 'Smart Questions' },
                { icon: <Shield size={14} />, text: 'Secure & Private' },
              ].map(({ icon, text }) => (
                <div key={text} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 24,
                  background: '#fff', border: '1px solid #e2e8f0',
                  fontSize: 13, fontWeight: 500, color: '#475569',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}>
                  <span style={{ color: '#2563eb' }}>{icon}</span> {text}
                </div>
              ))}
            </div>

            {/* Azure status banner */}
            {AZURE_CONFIGURED && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 20px', borderRadius: 12, marginBottom: 24,
                background: '#f0fdf4', border: '1px solid #bbf7d0',
              }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Azure OpenAI Connected</span>
                  <span style={{ fontSize: 13, color: '#16a34a', marginLeft: 8 }}>
                    calendax-resource · gpt-4o · Ready to generate forms
                  </span>
                </div>
              </div>
            )}

            {/* Main card */}
            <div style={{
              background: '#fff', borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '28px 32px' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 16 }}>
                  Upload Protocol Document
                </p>
                <FileUpload onFileSelect={handleFileSelect} isProcessing={false} />
              </div>
            </div>

            {error && (
              <div style={{
                marginTop: 16, padding: '14px 18px', borderRadius: 12,
                background: '#fef2f2', border: '1px solid #fecaca',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontWeight: 600, color: '#dc2626', fontSize: 14 }}>Error</p>
                  <p style={{ color: '#ef4444', fontSize: 13, marginTop: 2 }}>{error}</p>
                </div>
              </div>
            )}

            {/* How it works */}
            <div style={{ marginTop: 48, textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', letterSpacing: 1, marginBottom: 24, textTransform: 'uppercase' }}>
                How it works
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[
                  { step: '01', title: 'Upload Protocol', desc: 'Upload your research protocol as PDF, DOCX, or TXT' },
                  { step: '02', title: 'AI Analysis', desc: 'Azure AI reads and understands your protocol structure' },
                  { step: '03', title: 'Download Form', desc: 'Get a structured form with relevant questions as a PDF' },
                ].map(item => (
                  <div key={item.step} style={{
                    background: '#fff', padding: '24px 20px', borderRadius: 16,
                    border: '1px solid #e2e8f0', textAlign: 'left',
                  }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#2563eb',
                      fontFamily: 'monospace', marginBottom: 10, display: 'block',
                    }}>{item.step}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{item.title}</h3>
                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'processing' && processing && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minHeight: 480, textAlign: 'center',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
            }}>
              <Loader size={36} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              Generating Your Form
            </h2>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 32 }}>
              {processing.message}
            </p>

            <div style={{ width: 320, background: '#e2e8f0', borderRadius: 8, height: 8, marginBottom: 12 }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                width: `${processing.progress}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>{processing.progress}% complete</p>

            <div style={{ display: 'flex', gap: 8, marginTop: 32 }}>
              {(['extracting', 'analyzing', 'building'] as const).map(s => (
                <div key={s} style={{
                  padding: '6px 14px', borderRadius: 20,
                  background: processing.stage === s ? '#eff6ff' : '#f1f5f9',
                  color: processing.stage === s ? '#2563eb' : '#94a3b8',
                  fontSize: 12, fontWeight: 600,
                  border: `1px solid ${processing.stage === s ? '#bfdbfe' : '#e2e8f0'}`,
                }}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'form' && form && (
          <FormPreview form={form} onReset={() => { setForm(null); setStep('upload'); }} />
        )}
      </main>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
