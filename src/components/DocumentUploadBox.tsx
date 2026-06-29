import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle, Plus } from 'lucide-react';

interface DocumentUploadBoxProps {
  /** Title shown above the box, e.g. "Protocol" or "eCRF / Completion Guide". */
  label: string;
  hint?: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  isProcessing?: boolean;
  maxFiles?: number;
  /** Marks the box as required (shows a small required tag). */
  required?: boolean;
  /** Accent color for the icon/active border. */
  accent?: string;
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md';
const MAX_MB = 10;
const ALLOWED_EXT = ['pdf', 'docx', 'doc', 'txt', 'md'];

// A single-purpose labeled dropzone. The document role is fixed by the box
// (Protocol vs eCRF), so there is no per-file type dropdown.
export default function DocumentUploadBox({
  label,
  hint,
  files,
  onFilesChange,
  isProcessing = false,
  maxFiles = 3,
  required,
  accent = '#2563eb',
}: DocumentUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `"${file.name}" is too large. Max ${MAX_MB}MB.`;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `"${file.name}" has an unsupported format.`;
    return null;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];
    for (const file of Array.from(incoming)) {
      const err = validate(file);
      if (err) { errors.push(err); continue; }
      const isDup =
        files.some((f) => f.name === file.name && f.size === file.size) ||
        valid.some((f) => f.name === file.name && f.size === file.size);
      if (!isDup) valid.push(file);
    }
    const remaining = maxFiles - files.length;
    if (valid.length > remaining) errors.push(`Up to ${maxFiles} files here.`);
    const toAdd = valid.slice(0, remaining);
    if (toAdd.length) onFilesChange([...files, ...toAdd]);
    setError(errors.length ? errors.join(' ') : null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
    setError(null);
  };

  const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const canAddMore = files.length < maxFiles;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{label}</span>
        {required && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#c2410c', background: '#fdecdf', padding: '1px 7px', borderRadius: 10, letterSpacing: 0.3 }}>
            REQUIRED
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#94a3b8' }}>{files.length}/{maxFiles}</span>
      </div>
      {hint && <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>{hint}</p>}

      <input ref={inputRef} type="file" accept={ACCEPTED} multiple onChange={onInputChange} style={{ display: 'none' }} />

      {files.length === 0 ? (
        <div
          className="lift"
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? accent : '#cbd5e1'}`,
            borderRadius: 14, padding: '28px 18px', textAlign: 'center', cursor: 'pointer',
            background: dragOver ? '#eff6ff' : '#f8fafc', transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: dragOver ? '#dbeafe' : '#e8edf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <Upload size={22} color={dragOver ? accent : '#64748b'} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 4 }}>Drag & drop or click</p>
          <p style={{ fontSize: 12, color: '#94a3b8' }}>PDF · DOCX · TXT · max {MAX_MB}MB</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} style={{
              border: '1.5px solid #e8edf4', borderRadius: 11, padding: '10px 12px', background: '#f8fafc',
              display: 'flex', alignItems: 'center', gap: 11,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={17} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 1 }}>{formatSize(file.size)}</p>
              </div>
              {!isProcessing && (
                <button onClick={() => removeFile(index)} className="lift" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8', flexShrink: 0 }} aria-label={`Remove ${file.name}`}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {canAddMore && !isProcessing && (
            <div className="lift" onClick={() => inputRef.current?.click()} style={{
              border: '1.5px dashed #cbd5e1', borderRadius: 11, padding: '9px', cursor: 'pointer', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Plus size={15} color={accent} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: accent }}>Add file</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#dc2626', fontSize: 12, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
