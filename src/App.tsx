import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, AlertCircle, Loader, CheckCircle2,
  FileText, Layers, AlertTriangle, FileOutput,
} from 'lucide-react';
import DocumentUploadBox from './components/DocumentUploadBox';
import OptionsPanel from './components/OptionsPanel';
import StudyBuilder, { type Tab as StudyTab } from './components/StudyBuilder';
import StudyLibrary from './components/StudyLibrary';
import TemplateManager from './components/TemplateManager';
import Sidebar, { SIDEBAR_WIDTH, type AppView } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PassLock, { isUnlocked, lockApp } from './components/PassLock';
import { extractTextFromFiles } from './utils/extractText';
import { buildStudyFromDocuments, listTemplates } from './utils/api';
import type { BuildOptions, BuildTreeRow } from './utils/api';
import type { StudyModel, IngestedDocument, Template } from './types/study';
import { DEMO_STUDY } from './utils/demoStudy';

type Step = 'upload' | 'processing' | 'build';

const CONFIGURED = !!import.meta.env.VITE_API_BASE_URL;
const DEMO_MODE = typeof window !== 'undefined' && window.location.hash === '#demo';

// URL <-> view mapping. Each main view is a real route so refresh, back/forward,
// and deep links land on the right page; unknown paths redirect to /dashboard.
const VIEW_TO_PATH: Record<AppView, string> = {
  dashboard: '/dashboard',
  builder: '/build',
  library: '/e-sources',
  drafts: '/drafts',
  templates: '/templates',
  trash: '/trash',
};
const PATH_TO_VIEW: Record<string, AppView> = {
  '/dashboard': 'dashboard',
  '/build': 'builder',
  '/e-sources': 'library',
  '/drafts': 'drafts',
  '/templates': 'templates',
  '/trash': 'trash',
};

export default function App() {
  const [locked, setLocked] = useState(() => !isUnlocked());
  const navigate = useNavigate();
  const location = useLocation();
  // View is derived from the URL; navigating sets the URL.
  const view: AppView = PATH_TO_VIEW[location.pathname] ?? 'dashboard';
  const setView = (v: AppView) => navigate(VIEW_TO_PATH[v]);

  // Normalize entry: demo hash → /build; "/" or any unknown path → /dashboard.
  useEffect(() => {
    if (DEMO_MODE) { if (location.pathname !== '/build') navigate('/build', { replace: true }); return; }
    if (!PATH_TO_VIEW[location.pathname]) navigate('/dashboard', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const [studyTab, setStudyTab] = useState<StudyTab>('build');
  const [step, setStep] = useState<Step>(DEMO_MODE ? 'build' : 'upload');
  const [protocolFiles, setProtocolFiles] = useState<File[]>([]);
  const [ecrfFiles, setEcrfFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<BuildOptions>({});
  const [study, setStudy] = useState<StudyModel | null>(DEMO_MODE ? DEMO_STUDY : null);
  const [currentStudyId, setCurrentStudyId] = useState<string | undefined>(undefined);
  const [corpusText, setCorpusText] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ingestIndex, setIngestIndex] = useState(0);
  const [stageMsg, setStageMsg] = useState('');
  // Live build tree streamed from the server (arm → folder → forms).
  const [buildTree, setBuildTree] = useState<BuildTreeRow[]>([]);

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
    setBuildTree([]);

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

      setStageMsg('AI is building the structured study…');
      const prefs = templates.find(t => t.id === options.templateId)?.preferences;
      // Live progress streams from the server: real phase, percent, and the
      // arm → folder → form tree filling in as each form is built.
      const built = await buildStudyFromDocuments(text, documents, options, prefs, (p) => {
        if (p.phase) setStageMsg(p.phase);
        if (typeof p.progress === 'number') setProgress(50 + Math.round(p.progress * 0.48));
        if (p.partial) setBuildTree(p.partial);
      });
      setProgress(99);

      setStudy(built);
      setCurrentStudyId(undefined); // a fresh, unsaved build
      setStudyTab('build');
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
    setStudyTab('build');
    setStep('upload');
  };

  const handleOpenSaved = (s: StudyModel, id: string) => {
    setStudy(s);
    setCurrentStudyId(id);
    setCorpusText(''); // saved studies don't carry the original corpus
    setStudyTab('build');
    setStep('build');
    setView('builder');
  };

  // Sidebar "New Build": confirm before discarding an open eSource.
  const handleNewBuild = () => {
    if (step === 'build' && study) {
      if (!window.confirm('Discard the current eSource and start a new build?')) return;
      handleReset();
    }
    setView('builder');
  };

  if (locked) return <PassLock onUnlock={() => setLocked(false)} />;

  const studyOpen = step === 'build' && !!study;

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sidebar
        view={view}
        onNavigate={setView}
        onNewBuild={handleNewBuild}
        study={study}
        studyOpen={studyOpen}
        studyTab={studyTab}
        onStudyTab={(t) => { setStudyTab(t); setView('builder'); }}
        apiConfigured={CONFIGURED}
        onLock={() => { lockApp(); setLocked(true); }}
      />

      <main style={{
        marginLeft: SIDEBAR_WIDTH,
        padding: view === 'builder'
          ? (step === 'build' ? '28px 32px 64px' : '24px 32px 32px')
          : '40px 32px 64px',
      }}>
        <div style={{ maxWidth: view === 'builder' && step === 'build' ? 1600 : 1080, margin: '0 auto' }}>
        {view === 'dashboard' && (
          <Dashboard
            onNewBuild={handleNewBuild}
            onOpenStudy={handleOpenSaved}
            onOpenLibrary={() => setView('library')}
            onOpenDrafts={() => setView('drafts')}
            onOpenTemplates={() => setView('templates')}
          />
        )}
        {view === 'library' && <StudyLibrary mode="final" onOpen={handleOpenSaved} />}
        {view === 'drafts' && <StudyLibrary mode="drafts" onOpen={handleOpenSaved} />}
        {view === 'trash' && <StudyLibrary mode="trash" onOpen={handleOpenSaved} />}
        {view === 'templates' && <TemplateManager onChanged={loadTemplates} />}

        {view === 'builder' && step === 'upload' && (
          <>
            {/* Page header: title left, slim pipeline strip right. */}
            <div className="float-in" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 18, flexWrap: 'wrap', marginBottom: 18,
            }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0b1220', letterSpacing: -0.5 }}>New Build</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { icon: <FileText size={12} />, text: 'Ingestion' },
                  { icon: <Layers size={12} />, text: 'Build' },
                  { icon: <CheckCircle2 size={12} />, text: 'Review' },
                  { icon: <AlertTriangle size={12} />, text: 'Intelligence' },
                  { icon: <FileOutput size={12} />, text: 'Export' },
                ].map(({ icon, text }, i) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(226,232,240,0.9)', fontSize: 11.5, fontWeight: 600, color: '#475569',
                    }}>
                      <span style={{ color: i === 1 ? '#f26a1b' : '#2563eb', display: 'inline-flex' }}>{icon}</span> {text}
                    </div>
                    {i < 4 && <span style={{ color: '#cbd5e1', fontSize: 12 }}>→</span>}
                  </div>
                ))}
              </div>
            </div>

            <OptionsPanel options={options} onChange={setOptions} templates={templates} />

            <div style={{
              background: '#fff', borderRadius: 22, border: '1px solid #eaeef4',
              boxShadow: '0 18px 40px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)', overflow: 'hidden',
            }}>
              <div style={{ height: 4, background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 35%, #f26a1b 100%)' }} />
              <div style={{ padding: '20px 26px 22px' }}>
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 3 }}>Study Documents</p>
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
                  width: '100%', marginTop: 16, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 9, padding: '13px', borderRadius: 13, border: 'none',
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
            <p style={{ textAlign: 'center', fontSize: 11.5, color: '#94a3b8', marginTop: 14, maxWidth: 640, marginInline: 'auto', lineHeight: 1.5 }}>
              Conceptual reference only. AI generation is real; study data may be representative. Every AI output is a
              draft a human approves — not certified or submission-ready.
            </p>
          </>
        )}

        {view === 'builder' && step === 'processing' && (
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

            {/* Live build tree — arms → folders → forms filling in as the AI works */}
            {buildTree.length > 0 && (() => {
              const arms = Array.from(new Set(buildTree.map(r => r.arm)));
              return (
                <div style={{ width: 480, maxWidth: '100%', marginTop: 24, textAlign: 'left', maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', padding: '12px 14px' }}>
                  {arms.map(arm => (
                    <div key={arm} style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{arm}</p>
                      {buildTree.filter(r => r.arm === arm).map((r, i) => (
                        <div key={`${r.folder}-${i}`} style={{ paddingLeft: 8, marginBottom: 3 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{r.folder}</p>
                          <div style={{ paddingLeft: 10, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                            {r.forms.map((f, j) => (
                              <span key={`${f.name}-${j}`} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                                color: f.fieldCount > 0 ? '#15803d' : '#94a3b8',
                              }}>
                                {f.fieldCount > 0 ? <CheckCircle2 size={11} /> : <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                                {f.name}{f.fieldCount > 0 ? ` (${f.fieldCount})` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {view === 'builder' && step === 'build' && study && (
          <StudyBuilder
            study={study}
            setStudy={setStudy}
            onReset={handleReset}
            studyId={currentStudyId}
            protocolText={corpusText}
            onStudyIdChange={setCurrentStudyId}
            autoSaveEnabled={CONFIGURED && !DEMO_MODE}
            tab={studyTab}
            onTabChange={setStudyTab}
          />
        )}
        </div>
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
