import {
  Layers, Sparkles, FolderOpen, SlidersHorizontal, ListChecks,
  AlertTriangle, FileOutput, Lock, LayoutDashboard, PenLine, Trash2,
} from 'lucide-react';
import type { StudyModel } from '../types/study';

export const SIDEBAR_WIDTH = 240;

export type AppView = 'dashboard' | 'builder' | 'library' | 'drafts' | 'templates' | 'trash';
export type StudyTab = 'build' | 'eligibility' | 'intelligence' | 'export' | 'settings';

interface SidebarProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  onNewBuild: () => void;
  /** The open study (when built) drives the "Current eSource" section. */
  study: StudyModel | null;
  studyOpen: boolean;
  studyTab: StudyTab;
  onStudyTab: (tab: StudyTab) => void;
  apiConfigured: boolean;
  onLock: () => void;
}

export default function Sidebar({
  view, onNavigate, onNewBuild, study, studyOpen, studyTab, onStudyTab, apiConfigured, onLock,
}: SidebarProps) {
  const unresolved = study?.findings.filter((f) => !f.resolved).length ?? 0;

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH, zIndex: 100,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      background:
        'radial-gradient(420px 260px at 110% -8%, rgba(242,106,27,0.22) 0%, rgba(242,106,27,0) 60%),' +
        'linear-gradient(180deg, #0b1220 0%, #101b2f 60%, #15233c 100%)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      padding: '20px 14px 16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 6 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #f26a1b 130%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(242,106,27,0.28), 0 1px 0 rgba(255,255,255,0.25) inset',
        }}>
          <Layers size={18} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 800, fontSize: 14.5, color: '#fff', letterSpacing: -0.2, lineHeight: 1.2 }}>eSource Builder</p>
          <p style={{ fontSize: 9.5, fontWeight: 700, color: '#f6a06b', letterSpacing: 1, textTransform: 'uppercase' }}>Protocol Builder</p>
        </div>
      </div>

      {/* Workspace nav */}
      <SectionLabel>Workspace</SectionLabel>
      <NavItem icon={<LayoutDashboard size={15} />} label="Dashboard"
        active={view === 'dashboard'} onClick={() => onNavigate('dashboard')} />
      <NavItem icon={<Sparkles size={15} />} label="New Build"
        active={view === 'builder' && !studyOpen} onClick={onNewBuild} />
      <NavItem icon={<PenLine size={15} />} label="Drafts"
        active={view === 'drafts'} onClick={() => onNavigate('drafts')} disabled={!apiConfigured} />
      <NavItem icon={<FolderOpen size={15} />} label="My E-Sources"
        active={view === 'library'} onClick={() => onNavigate('library')} disabled={!apiConfigured} />
      <NavItem icon={<SlidersHorizontal size={15} />} label="Preferences Templates"
        active={view === 'templates'} onClick={() => onNavigate('templates')} disabled={!apiConfigured} />
      <NavItem icon={<Trash2 size={15} />} label="Trash"
        active={view === 'trash'} onClick={() => onNavigate('trash')} disabled={!apiConfigured} />

      {/* Current eSource sections */}
      {studyOpen && study && (
        <>
          <SectionLabel style={{ marginTop: 18 }}>Current eSource</SectionLabel>
          <p style={{
            fontSize: 11.5, color: 'rgba(226,232,240,0.55)', padding: '0 10px', marginBottom: 8,
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.4,
          }}>
            {study.studyTitle}
          </p>
          <NavItem icon={<Layers size={15} />} label="Study Build"
            active={view === 'builder' && studyTab === 'build'} onClick={() => onStudyTab('build')} />
          <NavItem icon={<ListChecks size={15} />} label="Eligibility" badge={study.eligibility.length || undefined}
            active={view === 'builder' && studyTab === 'eligibility'} onClick={() => onStudyTab('eligibility')} />
          <NavItem icon={<AlertTriangle size={15} />} label="Intelligence" badge={unresolved || undefined}
            active={view === 'builder' && studyTab === 'intelligence'} onClick={() => onStudyTab('intelligence')} />
          <NavItem icon={<SlidersHorizontal size={15} />} label="eSource Settings"
            active={view === 'builder' && studyTab === 'settings'} onClick={() => onStudyTab('settings')} />
          <NavItem icon={<FileOutput size={15} />} label="Export"
            active={view === 'builder' && studyTab === 'export'} onClick={() => onStudyTab('export')} />
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
        <NavItem icon={<Lock size={14} />} label="Lock workspace" active={false} onClick={onLock} />
      </div>
    </aside>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, color: 'rgba(148,163,184,0.7)', letterSpacing: 1.2,
      textTransform: 'uppercase', padding: '0 10px', margin: '14px 0 6px', ...style,
    }}>
      {children}
    </p>
  );
}

function NavItem({ icon, label, active, onClick, badge, disabled }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
  badge?: number; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={disabled ? 'Requires the backend API' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', marginBottom: 2, borderRadius: 9, border: 'none',
        background: active ? 'rgba(242,106,27,0.16)' : 'transparent',
        color: disabled ? 'rgba(148,163,184,0.4)' : active ? '#fca86f' : '#cbd5e1',
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left', boxShadow: active ? '0 0 0 1px rgba(242,106,27,0.28) inset' : undefined,
        transition: 'background 0.12s ease, color 0.12s ease',
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {badge ? (
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
          background: 'rgba(255,255,255,0.12)', color: '#e2e8f0',
        }}>{badge}</span>
      ) : null}
    </button>
  );
}
