import { useState } from 'react';
import { Settings2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { FormOptions } from '../utils/claude';
import { DEFAULT_OPTIONS } from '../utils/claude';

interface OptionsPanelProps {
  options: FormOptions;
  onChange: (options: FormOptions) => void;
  disabled?: boolean;
}

const DETAIL_LEVELS: { value: NonNullable<FormOptions['detailLevel']>; label: string }[] = [
  { value: 'concise', label: 'Concise' },
  { value: 'standard', label: 'Standard' },
  { value: 'detailed', label: 'Detailed' },
];

export default function OptionsPanel({ options, onChange, disabled }: OptionsPanelProps) {
  const [open, setOpen] = useState(false);

  const o = { ...DEFAULT_OPTIONS, ...options };

  const update = (patch: Partial<FormOptions>) => onChange({ ...options, ...patch });
  const reset = () => onChange({});

  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 9,
    border: '1.5px solid #e2e8f0', background: '#fff',
    fontSize: 13.5, color: '#1e293b', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      border: '1px solid #e2e8f0', overflow: 'hidden',
      marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 24px', background: '#fafbff', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: '#eff6ff', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Settings2 size={17} color="#2563eb" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Customize Form Generation</p>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
            {open ? 'Adjust how the AI builds your form' : 'Prompt, question count, sections, detail level & more'}
          </p>
        </div>
        {open ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
      </button>

      {open && (
        <div style={{ padding: '20px 24px', borderTop: '1px solid #f1f5f9' }}>
          {/* Form type */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Form type / purpose</label>
            <input
              type="text"
              value={o.formType}
              disabled={disabled}
              onChange={e => update({ formType: e.target.value })}
              placeholder="e.g. clinical research eSource data collection form"
              style={inputStyle}
            />
          </div>

          {/* Number inputs row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Number of questions: {o.questionCount}</label>
              <input
                type="range" min={10} max={60} step={5}
                value={o.questionCount}
                disabled={disabled}
                onChange={e => update({ questionCount: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                <span>10</span><span>60</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Number of sections: {o.sectionCount}</label>
              <input
                type="range" min={2} max={12} step={1}
                value={o.sectionCount}
                disabled={disabled}
                onChange={e => update({ sectionCount: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                <span>2</span><span>12</span>
              </div>
            </div>
          </div>

          {/* Detail level */}
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Detail level</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DETAIL_LEVELS.map(level => (
                <button
                  key={level.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => update({ detailLevel: level.value })}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 9,
                    border: `1.5px solid ${o.detailLevel === level.value ? '#2563eb' : '#e2e8f0'}`,
                    background: o.detailLevel === level.value ? '#eff6ff' : '#fff',
                    color: o.detailLevel === level.value ? '#2563eb' : '#64748b',
                    fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom instructions */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Custom instructions for the AI</label>
            <textarea
              value={o.customInstructions}
              disabled={disabled}
              onChange={e => update({ customInstructions: e.target.value })}
              rows={4}
              placeholder="e.g. Focus on adverse events and concomitant medications. Include a section for informed consent verification. Use plain language suitable for site coordinators."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 88, lineHeight: 1.5 }}
            />
            <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 6 }}>
              These instructions are added to the AI prompt to tailor the questions, structure, and wording.
            </p>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={reset}
            disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#f8fafc',
              cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 500, color: '#475569',
            }}
          >
            <RotateCcw size={13} /> Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
