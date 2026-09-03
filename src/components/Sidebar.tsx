import {
  Layers, Sparkles, FolderOpen, SlidersHorizontal, ListChecks,
  AlertTriangle, FileOutput, LogOut, LayoutDashboard, PenLine, Trash2, FolderTree, ClipboardList, History,
} from 'lucide-react';
import type { StudyModel } from '../types/study';
import type { AuthUser } from '../utils/authToken';

export const SIDEBAR_WIDTH = 244;

export type AppView = 'dashboard' | 'builder' | 'library' | 'drafts' | 'trash';
export type StudyTab = 'build' | 'folders' | 'data' | 'audit' | 'eligibility' | 'intelligence' | 'export' | 'settings';

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
  /** The logged-in user — shown in the footer. */
  user: AuthUser;
  onLock: () => void;
}

export default function Sidebar({
  view, onNavigate, onNewBuild, study, studyOpen, studyTab, onStudyTab, apiConfigured, user, onLock,
}: SidebarProps) {
  const unresolved = study?.findings.filter((f) => !f.resolved).length ?? 0;

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0, width: SIDEBAR_WIDTH, zIndex: 100,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      background: '#17100F',
      padding: '22px 14px 16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 22px' }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(160deg, #F08080, #9C3733)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>
          E
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: '#F3F1EC', letterSpacing: '-0.015em', lineHeight: 1.2 }}>EsourcEngine</p>
        </div>
      </div>

      {/* Workspace nav */}
      <SectionLabel>Workspace</SectionLabel>
      <NavItem icon={<LayoutDashboard size={15} />} label="Dashboard"
        active={view === 'dashboard'} onClick={() => onNavigate('dashboard')} />
      <NavItem icon={<Sparkles size={15} />} label="New eSource"
        active={view === 'builder' && !studyOpen} onClick={onNewBuild} />
      <NavItem icon={<PenLine size={15} />} label="Drafts"
        active={view === 'drafts'} onClick={() => onNavigate('drafts')} disabled={!apiConfigured} />
      <NavItem icon={<FolderOpen size={15} />} label="My E-Sources"
        active={view === 'library'} onClick={() => onNavigate('library')} disabled={!apiConfigured} />
      <NavItem icon={<Trash2 size={15} />} label="Trash"
        active={view === 'trash'} onClick={() => onNavigate('trash')} disabled={!apiConfigured} />

      {/* Current eSource sections */}
      {studyOpen && study && (
        <>
          <SectionLabel style={{ marginTop: 22 }}>Current eSource</SectionLabel>
          <div style={{
            margin: '0 4px 10px', padding: '10px 12px', borderRadius: 10,
            background: '#221614', border: '1px solid #33211F',
          }}>
            <p style={{
              color: '#D6D2CA', fontSize: 12.5, fontWeight: 600, lineHeight: 1.35,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {study.studyTitle}
            </p>
            {study.protocolNumber && (
              <p style={{ color: '#8C7875', fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, marginTop: 3 }}>
                {study.protocolNumber}{study.phase ? ` · ${study.phase}` : ''}
              </p>
            )}
          </div>
          <NavItem icon={<Layers size={15} />} label="Study Build"
            active={view === 'builder' && studyTab === 'build'} onClick={() => onStudyTab('build')} />
          <NavItem icon={<FolderTree size={15} />} label="Folders"
            active={view === 'builder' && studyTab === 'folders'} onClick={() => onStudyTab('folders')} />
          <NavItem icon={<ClipboardList size={15} />} label="Data Entry"
            active={view === 'builder' && studyTab === 'data'} onClick={() => onStudyTab('data')} />
          <NavItem icon={<History size={15} />} label="Audit Trail"
            active={view === 'builder' && studyTab === 'audit'} onClick={() => onStudyTab('audit')} />
          <NavItem icon={<ListChecks size={15} />} label="Eligibility" badge={study.eligibility.length || undefined}
            active={view === 'builder' && studyTab === 'eligibility'} onClick={() => onStudyTab('eligibility')} />
          <NavItem icon={<AlertTriangle size={15} />} label="Intelligence" badge={unresolved || undefined} badgeWarn={!!unresolved}
            active={view === 'builder' && studyTab === 'intelligence'} onClick={() => onStudyTab('intelligence')} />
          <NavItem icon={<SlidersHorizontal size={15} />} label="eSource Settings"
            active={view === 'builder' && studyTab === 'settings'} onClick={() => onStudyTab('settings')} />
          <NavItem icon={<FileOutput size={15} />} label="Export"
            active={view === 'builder' && studyTab === 'export'} onClick={() => onStudyTab('export')} />
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid #2B1D1B', paddingTop: 10 }}>
        <div style={{ padding: '0 10px 8px', overflow: 'hidden' }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: '#E7E4DE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
          <p style={{ fontSize: 10.5, color: '#8C7875', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{user.role}</p>
        </div>
        <NavItem icon={<LogOut size={14} />} label="Log out" active={false} onClick={onLock} />
      </div>
    </aside>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, color: '#7A6663', letterSpacing: '0.11em',
      textTransform: 'uppercase', padding: '0 10px', margin: '0 0 8px', ...style,
    }}>
      {children}
    </p>
  );
}

function NavItem({ icon, label, active, onClick, badge, badgeWarn, disabled }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
  badge?: number; badgeWarn?: boolean; disabled?: boolean;
}) {
  return (
    <button
      className="ee-nav-item"
      onClick={onClick} disabled={disabled} title={disabled ? 'Requires the backend API' : undefined}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', marginBottom: 2, borderRadius: 8, border: 'none',
        background: active ? '#3A1F1D' : 'transparent',
        color: disabled ? '#5A4A47' : active ? '#FFE7E4' : '#B3A29F',
        fontSize: 13.5, fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left', transition: 'background 0.12s ease, color 0.12s ease',
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {badge ? (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 500,
          padding: '1px 7px', borderRadius: 10,
          background: badgeWarn ? 'rgba(224,113,109,0.18)' : 'rgba(255,255,255,0.08)',
          color: badgeWarn ? '#F0A0A0' : '#96827F',
        }}>{badge}</span>
      ) : null}
    </button>
  );
}
