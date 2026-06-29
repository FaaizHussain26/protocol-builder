import { useEffect, useState } from 'react';
import {
  Sparkles, Shield, AlertCircle, Loader, CheckCircle2,
  FileText, Layers, AlertTriangle, FileOutput, FolderOpen, SlidersHorizontal,
} from 'lucide-react';
import DocumentUploadBox from './components/DocumentUploadBox';
import OptionsPanel from './components/OptionsPanel';
import StudyBuilder from './components/StudyBuilder';
import StudyLibrary from './components/StudyLibrary';
import TemplateManager from './components/TemplateManager';
import { extractTextFromFiles } from './utils/extractText';
import { buildStudyFromDocuments, listTemplates } from './utils/api';
import type { BuildOptions } from './utils/api';
import type { StudyModel, IngestedDocument, Template } from './types/study';
import { DEMO_STUDY } from './utils/demoStudy';

type Step = 'upload' | 'processing' | 'build';

const CONFIGURED = !!import.meta.env.VITE_API_BASE_URL;
const DEMO_MODE = typeof window !== 'undefined' && window.location.hash === '#demo';

export default function App() {
  const [step, setStep] = useState<Step>(DEMO_MODE ? 'build' : 'upload');
  const [protocolFiles, setProtocolFiles] = useState<File[]>([]);
  const [ecrfFiles, setEcrfFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<BuildOptions>({});
  const [study, setStudy] = useState<StudyModel | null>(DEMO_MODE ? DEMO_STUDY : null);
  const [currentStudyId, setCurrentStudyId] = useState<string | undefined>(undefined);
  const [corpusText, setCorpusText] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ingestIndex, setIngestIndex] = useState(0);
  const [stageMsg, setStageMsg] = useState('');

  // Load saved templates (when a backend is configured) for the build options.
  const loadTemplates = () => { if (CONFIGURED) listTemplates().then(setTemplates).catch(() => {}); };
  useEffect(loadTemplates, []);

  // Protocol leads the corpus (it carries the SOA); the eCRF enriches fields.
  const allFiles = [...protocolFiles, ...ecrfFiles];
  const docTypeOf = (f: File): string => (protocolFiles.includes(f) ? 'Protocol' : 'eCRF');

  const handleBuild = async () => {
    if (!CONFIGURED) { setError('Backend API is not configured. Set VITE_API_BASE_URL in your .env file and start the server.'); return; }
    if (protocolFiles.length === 0) { setError('Please upload at least the Protocol document.'); return; }
    setError(null);
    setStep('processing');
    setProgress(8);

    try {
      // Ingestion: walk each document so the user sees them being read.
      const documents: IngestedDocument[] = [];
      setStageMsg('Ingesting source documents...');
      for (let i = 0; i < allFiles.length; i++) {
        setIngestIndex(i);
        const f = allFiles[i];
        documents.push({ name: f.name, docType: docTypeOf(f), sizeBytes: f.size });
        setProgress(8 + Math.round(((i + 1) / allFiles.length) * 32));
        await new Promise(r => setTimeout(r, 280));
      }
      setIngestIndex(allFiles.length);

      setStageMsg('Reading document contents...');
      const text = await extractTextFromFiles(allFiles);
      if (text.trim().length < 100) {
        throw new Error('The document(s) appear to be empty or could not be read. Please try different files.');
      }
      setCorpusText(text);
      setProgress(52);

      setStageMsg('AI is building the structured study (visits → forms → fields)...');
      const prefs = templates.find(t => t.id === options.templateId)?.preferences;
      const built = await buildStudyFromDocuments(text, documents, options, prefs);
      setProgress(92);

      setStageMsg('Assembling review workspace...');
      await new Promise(r => setTimeout(r, 400));

      setStudy(built);
      setCurrentStudyId(undefined); // a fresh, unsaved build
      setStep('build');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStep('upload');
    } finally {
      setProgress(0);
      setIngestIndex(0);
    }
  };

  const handleReset = () => {
    setStudy(null);
    setCurrentStudyId(undefined);
    setCorpusText('');
    setProtocolFiles([]);
    setEcrfFiles([]);
    setStep('upload');
  };

  const handleOpenSaved = (s: StudyModel, id: string) => {
    setStudy(s);
    setCurrentStudyId(id);
    setCorpusText(''); // saved studies don't carry the original corpus
    setLibraryOpen(false);
    setStep('build');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* Top Nav */}
      <nav style={{
        background: 'rgba(255,255,255,0.72)', borderBottom: '1px solid rgba(226,232,240,0.8)',
        backdropFilter: 'blur(14px) saturate(140%)', WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 20px rgba(15,23,42,0.04)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #f26a1b 130%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(242,106,27,0.28), 0 1px 0 rgba(255,255,255,0.25) inset',
          }}>
            <Layers size={19} color="#fff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontWeight: 800, fontSize: 16.5, color: '#0f172a', letterSpacing: -0.3 }}>eSource Builder</span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 9px', letterSpacing: 0.3,
              borderRadius: 20, background: '#fdf1e8', color: '#ea5e0b',
              border: '1px solid #fbdcc4', textTransform: 'uppercase',
            }}>Protocol Builder</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {CONFIGURED && (
            <>
              <button onClick={() => setTemplatesOpen(true)} className="lift" style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9,
                border: '1px solid #e2e8f0', background: '#fff', color: '#334155',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>
                <SlidersHorizontal size={14} color="#2563eb" /> Preferences Templates
              </button>
              <button onClick={() => setLibraryOpen(true)} className="lift" style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9,
                border: '1px solid #e2e8f0', background: '#fff', color: '#334155',
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>
                <FolderOpen size={14} color="#2563eb" /> My Saved E-Sources
              </button>
            </>
          )}
          {CONFIGURED ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>API Connected</span>
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#64748b" />
              <span style={{ fontSize: 12, color: '#64748b' }}>Backend not configured</span>
            </span>
          )}
        </div>
      </nav>

      <StudyLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} onOpen={handleOpenSaved} />
      <TemplateManager open={templatesOpen} onClose={() => setTemplatesOpen(false)} onChanged={loadTemplates} />

      <main style={
        step === 'build'
          ? { maxWidth: 1600, margin: '0 auto', padding: '28px 32px 64px' }
          : { maxWidth: 1080, margin: '0 auto', padding: '40px 24px' }
      }>
        {step === 'upload' && (
          <>
            {/* Hero */}
            <div className="float-in" style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 14px 6px 10px', borderRadius: 20,
                background: 'rgba(255,255,255,0.7)', border: '1px solid #fbdcc4',
                boxShadow: '0 2px 10px rgba(242,106,27,0.10)', marginBottom: 20,
              }}>
                <Sparkles size={14} color="#f26a1b" />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#c2410c', letterSpacing: 0.2 }}>AI-Native eSource Build Pipeline</span>
              </div>
              <h1 style={{ fontSize: 44, fontWeight: 800, color: '#0b1220', marginBottom: 16, letterSpacing: -1.4, lineHeight: 1.1 }}>
                Documents in.<br />
                <span style={{
                  background: 'linear-gradient(100deg, #f26a1b 0%, #fb923c 55%, #f59e0b 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>An approved structured build out.</span>
              </h1>
              <p style={{ fontSize: 16.5, color: '#52617a', maxWidth: 620, margin: '0 auto', lineHeight: 1.65 }}>
                Upload your protocol and supporting source documents. The AI reads across all of them and
                builds one structured study — visits, forms, and typed fields — that a reviewer can correct and approve.
              </p>
            </div>

            {/* Pipeline strip */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
              {[
                { icon: <FileText size={14} />, text: 'Ingestion' },
                { icon: <Layers size={14} />, text: 'Structured Build' },
                { icon: <CheckCircle2 size={14} />, text: 'Human Review' },
                { icon: <AlertTriangle size={14} />, text: 'Intelligence' },
                { icon: <FileOutput size={14} />, text: 'CTMS Export' },
              ].map(({ icon, text }, i) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 15px', borderRadius: 24, background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(226,232,240,0.9)', fontSize: 13, fontWeight: 600, color: '#334155',
                    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                  }}>
                    <span style={{ color: i === 1 ? '#f26a1b' : '#2563eb', display: 'inline-flex' }}>{icon}</span> {text}
                  </div>
                  {i < 4 && <span style={{ color: '#cbd5e1', fontSize: 15 }}>→</span>}
                </div>
              ))}
            </div>

            {CONFIGURED && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                borderRadius: 12, marginBottom: 24, background: '#f0fdf4', border: '1px solid #bbf7d0',
              }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>AI Connected</span>
                <span style={{ fontSize: 13, color: '#16a34a' }}>· Ready to build your structured study</span>
              </div>
            )}

            <OptionsPanel options={options} onChange={setOptions} templates={templates} />

            <div style={{
              background: '#fff', borderRadius: 22, border: '1px solid #eaeef4',
              boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', overflow: 'hidden',
            }}>
              <div style={{ height: 4, background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 35%, #f26a1b 100%)' }} />
              <div style={{ padding: '28px 32px' }}>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Study Documents</p>
                  <p style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
                    The <strong style={{ color: '#475569' }}>Protocol</strong> drives the visit schedule (its Schedule of Activities table + footnotes).
                    The <strong style={{ color: '#475569' }}>eCRF / Completion Guide</strong> supplies the exact forms and fields.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <DocumentUploadBox
                    label="Protocol"
                    required
                    hint="Clinical study protocol containing the Schedule of Activities."
                    files={protocolFiles}
                    onFilesChange={setProtocolFiles}
                    accent="#2563eb"
                  />
                  <DocumentUploadBox
                    label="eCRF / Completion Guide"
                    hint="eCRF or CRF completion requirements (recommended for full field detail)."
                    files={ecrfFiles}
                    onFilesChange={setEcrfFiles}
                    accent="#f26a1b"
                  />
                </div>

                <button onClick={handleBuild} disabled={protocolFiles.length === 0} style={{
                  width: '100%', marginTop: 22, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 9, padding: '15px', borderRadius: 13, border: 'none',
                  background: protocolFiles.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #fb8c3b 0%, #f26a1b 55%, #ea5e0b 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: 0.1,
                  cursor: protocolFiles.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: protocolFiles.length === 0 ? 'none' : '0 10px 22px rgba(234,94,11,0.32), 0 1px 0 rgba(255,255,255,0.3) inset',
                  transition: 'transform 0.12s ease, box-shadow 0.2s ease',
                }}>
                  <Sparkles size={17} />
                  Build Structured eSource{allFiles.length > 1 ? ` from ${allFiles.length} documents` : ''}
                </button>
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

            {/* Disclaimer */}
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 28, maxWidth: 640, marginInline: 'auto', lineHeight: 1.5 }}>
              Conceptual reference only. AI generation is real; study data may be representative. Every AI output is a
              draft a human approves — not certified or submission-ready.
            </p>
          </>
        )}

        {step === 'processing' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: 480, textAlign: 'center',
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <Loader size={36} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Building Your Study</h2>
            <p style={{ fontSize: 15, color: '#64748b', marginBottom: 28 }}>{stageMsg}</p>

            {/* Ingestion checklist */}
            <div style={{ width: 380, maxWidth: '100%', marginBottom: 24 }}>
              {allFiles.map((f, i) => {
                const done = i < ingestIndex;
                const active = i === ingestIndex;
                return (
                  <div key={`${f.name}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 9, marginBottom: 6,
                    background: done ? '#f0fdf4' : active ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${done ? '#bbf7d0' : active ? '#bfdbfe' : '#e2e8f0'}`,
                  }}>
                    {done
                      ? <CheckCircle2 size={15} color="#16a34a" />
                      : active
                        ? <Loader size={15} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
                        : <FileText size={15} color="#94a3b8" />}
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{docTypeOf(f)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ width: 320, background: '#e2e8f0', borderRadius: 8, height: 8, marginBottom: 12 }}>
              <div style={{
                height: '100%', borderRadius: 8, background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                width: `${progress}%`, transition: 'width 0.5s ease',
              }} />
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>{progress}% complete</p>
          </div>
        )}

        {step === 'build' && study && (
          <StudyBuilder
            study={study}
            setStudy={setStudy}
            onReset={handleReset}
            studyId={currentStudyId}
            protocolText={corpusText}
            onStudyIdChange={setCurrentStudyId}
          />
        )}
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
