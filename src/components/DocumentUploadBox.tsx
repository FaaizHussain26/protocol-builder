import { useRef, useState } from 'react';
import { Upload, X, AlertCircle, Plus } from 'lucide-react';

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
  accent = '#BE4A46',
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

  const ext = (name: string) => (name.split('.').pop() ?? '').toUpperCase();

  const canAddMore = files.length < maxFiles;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#17181A' }}>{label}</span>
        {required && (
          <span style={{ fontSize: 10, fontWeight: 600, color: '#A02D24', background: '#FBEDEB', padding: '1px 7px', borderRadius: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Required
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#A29C90' }}>{files.length}/{maxFiles}</span>
      </div>
      {hint && <p style={{ fontSize: 12, color: '#8A857B', marginBottom: 10 }}>{hint}</p>}

      <input ref={inputRef} type="file" accept={ACCEPTED} multiple onChange={onInputChange} style={{ display: 'none' }} />

      {files.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragOver ? accent : '#D3CEC2'}`,
            borderRadius: 16, padding: '28px 18px', textAlign: 'center', cursor: 'pointer',
            background: '#fff', transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: dragOver ? '#FDF1F1' : '#F7F6F3',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <Upload size={20} color={dragOver ? accent : '#8A857B'} />
          </div>
          <p style={{ fontSize: 14.5, fontWeight: 600, color: '#17181A', marginBottom: 4 }}>Drag & drop or click</p>
          <p style={{ fontSize: 12.5, color: '#8A857B' }}>PDF · DOCX · TXT · max {MAX_MB}MB</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} style={{
              border: '1px solid #E6E3DC', borderRadius: 12, padding: '12px 14px', background: '#fff',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500, padding: '3px 7px', borderRadius: 5, background: '#F1EFEA', color: '#6E6A62', flexShrink: 0 }}>
                {ext(file.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, color: '#17181A', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#918B7F', marginTop: 3 }}>{formatSize(file.size)}</p>
              </div>
              {!isProcessing && (
                <button onClick={() => removeFile(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#A29C90', flexShrink: 0 }} aria-label={`Remove ${file.name}`}>
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          {canAddMore && !isProcessing && (
            <div onClick={() => inputRef.current?.click()} style={{
              border: '1.5px dashed #DCD8CF', borderRadius: 12, padding: '9px', cursor: 'pointer', background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              <Plus size={15} color={accent} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: accent }}>Add file</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 9, background: '#FBEDEB', border: '1px solid #F1CFCE', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <AlertCircle size={14} color="#A02D24" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#A02D24', fontSize: 12, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
