import { FileText, FileJson, BookOpen, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { StudyModel } from '../types/study';
import {
  generateCompletionGuidelinesPDF,
  generateBuildSpecPDF,
  downloadStudyJSON,
} from '../utils/generatePDF';

interface Stats {
  total: number; accepted: number; rejected: number; flagged: number; pending: number; openBlockers: number;
}

export default function ExportPanel({ study, stats }: { study: StudyModel; stats: Stats }) {
  const blocked = stats.openBlockers > 0;

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Approval status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
        padding: '14px 18px', borderRadius: 12,
        background: blocked ? '#FBEDEB' : '#EAF2ED',
        border: `1px solid ${blocked ? '#F1CFCE' : '#D3E4D9'}`,
      }}>
        {blocked ? <AlertOctagon size={18} color="#A02D24" /> : <CheckCircle2 size={18} color="#2F6B4F" />}
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: blocked ? '#973C38' : '#2F6B4F' }}>
            {blocked
              ? `Build has ${stats.openBlockers} open blocker${stats.openBlockers !== 1 ? 's' : ''}`
              : 'Build ready for CTMS-ready export'}
          </p>
          <p style={{ fontSize: 12.5, color: '#6E6A62', marginTop: 2 }}>
            {stats.accepted} of {stats.total} fields approved · {stats.flagged} flagged · {stats.pending} pending review
            {blocked && ' — resolve blockers in the Intelligence tab to finalize.'}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: '#6E6A62', marginBottom: 18, lineHeight: 1.5 }}>
        Export the reviewed build as deliverable artifacts. These are export files (a document and a
        structured data file), framed as ready to drive setup in a CTMS — not a live connection.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <ExportCard
          icon={<BookOpen size={20} color="#BE4A46" />}
          title="Completion Guidelines"
          desc="Every field's completion instruction, grouped by visit and form, as a PDF."
          buttonLabel="Download PDF"
          onClick={() => generateCompletionGuidelinesPDF(study)}
        />
        <ExportCard
          icon={<FileText size={20} color="#BE4A46" />}
          title="Build Specification (PDF)"
          desc="Study details, visit schedule, form & field summaries, accepted edit checks, and the review trail."
          buttonLabel="Download PDF"
          accent="#BE4A46"
          onClick={() => generateBuildSpecPDF(study, stats)}
        />
        <ExportCard
          icon={<FileJson size={20} color="#6E6A62" />}
          title="Structured Data File"
          desc="The complete study model as a structured JSON file for downstream CTMS configuration."
          buttonLabel="Download JSON"
          accent="#6E6A62"
          onClick={() => downloadStudyJSON(study)}
        />
      </div>

      <div style={{
        marginTop: 22, padding: '12px 16px', borderRadius: 10,
        background: '#FBFAF7', border: '1px solid #E6E3DC',
        fontSize: 12, color: '#6E6A62', lineHeight: 1.5,
      }}>
        <strong style={{ color: '#5C584F' }}>Note:</strong> These exports are draft artifacts. They are not certified or
        submission-ready. The CTMS-ready export produces a file, not a live system connection.
      </div>
    </div>
  );
}

function ExportCard({ icon, title, desc, buttonLabel, onClick, accent = '#BE4A46' }: {
  icon: React.ReactNode; title: string; desc: string; buttonLabel: string;
  onClick: () => void; accent?: string;
}) {
  return (
    <div style={{
      border: '1px solid #E6E3DC', borderRadius: 14, padding: '18px 18px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 11,
        background: '#FBFAF7', border: '1px solid #F1EFEA',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: 14.5, fontWeight: 700, color: '#17181A', marginBottom: 5 }}>{title}</h3>
        <p style={{ fontSize: 12.5, color: '#6E6A62', lineHeight: 1.5 }}>{desc}</p>
      </div>
      <button onClick={onClick} style={{
        marginTop: 4, padding: '10px', borderRadius: 9, border: 'none',
        background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        {buttonLabel}
      </button>
    </div>
  );
}
