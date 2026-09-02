import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
        const f = allFiles[i];
        documents.push({ name: f.name, docType: docTypeOf(f), sizeBytes: f.size });
        setProgress(8 + Math.round(((i + 1) / allFiles.length) * 32));
        await new Promise(r => setTimeout(r, 280));
      }

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

        {view === 'builder' && (step === 'upload' || step === 'processing') && (
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
            building={step === 'processing'}
            stageMsg={stageMsg}
            progress={progress}
            buildTree={buildTree}
          />
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
