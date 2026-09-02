import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Loader, CheckCircle2, FileText,
} from 'lucide-react';
import NewBuildWizard from './components/NewBuildWizard';
import StudyBuilder, { type Tab as StudyTab } from './components/StudyBuilder';
import StudyLibrary from './components/StudyLibrary';
import Sidebar, { SIDEBAR_WIDTH, type AppView } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PassLock, { isUnlocked, lockApp } from './components/PassLock';
import { extractTextFromFiles } from './utils/extractText';
import { buildStudyFromDocuments, reviewStudyForms } from './utils/api';
import type { BuildTreeRow } from './utils/api';
import type { StudyModel, IngestedDocument, TemplatePreferences } from './types/study';
import { DEFAULT_PREFERENCES } from './types/study';
import { DEMO_STUDY } from './utils/demoStudy';

type Step = 'upload' | 'processing' | 'build';

const CONFIGURED = !!import.meta.env.VITE_API_BASE_URL;
const DEMO_MODE = typeof window !== 'undefined' && window.location.hash === '#demo';

function blankPrefs(): TemplatePreferences {
  return { ...DEFAULT_PREFERENCES };
}

// URL <-> view mapping. Each main view is a real route so refresh, back/forward,
// and deep links land on the right page; unknown paths redirect to /dashboard.
const VIEW_TO_PATH: Record<AppView, string> = {
  dashboard: '/dashboard',
  builder: '/build',
  library: '/e-sources',
  drafts: '/drafts',
  trash: '/trash',
};
const PATH_TO_VIEW: Record<string, AppView> = {
  '/dashboard': 'dashboard',
  '/build': 'builder',
  '/e-sources': 'library',
  '/drafts': 'drafts',
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
  const [prefs, setPrefs] = useState<TemplatePreferences>(blankPrefs);
  const [wizardKey, setWizardKey] = useState(0);
  const [study, setStudy] = useState<StudyModel | null>(DEMO_MODE ? DEMO_STUDY : null);
  const [currentStudyId, setCurrentStudyId] = useState<string | undefined>(undefined);
  const [corpusText, setCorpusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ingestIndex, setIngestIndex] = useState(0);
  const [stageMsg, setStageMsg] = useState('');
  // Live build tree streamed from the server (arm → folder → forms).
  const [buildTree, setBuildTree] = useState<BuildTreeRow[]>([]);

  const resetWizard = () => {
    setPrefs(blankPrefs());
    setWizardKey((k) => k + 1);
  };

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
      // The wizard owns TemplatePreferences — no saved-template lookup.
      let buildJobId: string | undefined;
      const built = await buildStudyFromDocuments(text, documents, {}, prefs, (p) => {
        if (p.phase) setStageMsg(p.phase);
        if (typeof p.progress === 'number') setProgress(50 + Math.round(p.progress * 0.38));
        if (p.partial) setBuildTree(p.partial);
      }, (id) => { buildJobId = id; });

      // Second pass: the AI re-checks each generated form against the eCRF/Protocol
      // and repairs what the build missed. Best-effort — if it fails, the user still
      // gets the build.
      setStageMsg('AI is testing the forms…');
      setProgress(88);
      let finalStudy = built;
      try {
        finalStudy = await reviewStudyForms(
          { buildJobId, study: buildJobId ? undefined : built, protocolText: buildJobId ? undefined : text },
          (p) => {
            if (p.phase) setStageMsg(`AI is testing the forms — ${p.phase.toLowerCase()}`);
            if (typeof p.progress === 'number') setProgress(88 + Math.round(p.progress * 0.11));
          },
        );
      } catch {
        /* QA pass is optional — fall through with the built study */
      }
      setProgress(99);

      setStudy(finalStudy);
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
    resetWizard();
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
    } else {
      resetWizard();
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
          />
        )}
        {view === 'library' && <StudyLibrary mode="final" onOpen={handleOpenSaved} />}
        {view === 'drafts' && <StudyLibrary mode="drafts" onOpen={handleOpenSaved} />}
        {view === 'trash' && <StudyLibrary mode="trash" onOpen={handleOpenSaved} />}

        {view === 'builder' && step === 'upload' && (
          <NewBuildWizard
            key={wizardKey}
            prefs={prefs}
            onPrefsChange={setPrefs}
            protocolFiles={protocolFiles}
            onProtocolFilesChange={setProtocolFiles}
            ecrfFiles={ecrfFiles}
            onEcrfFilesChange={setEcrfFiles}
            onBuild={handleBuild}
            error={error}
          />
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
