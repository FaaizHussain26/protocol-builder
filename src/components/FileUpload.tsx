import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle, Plus } from 'lucide-react';

interface FileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  isProcessing: boolean;
  maxFiles?: number;
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md';
const MAX_MB = 10;
const ALLOWED_EXT = ['pdf', 'docx', 'doc', 'txt', 'md'];

export default function FileUpload({ files, onFilesChange, isProcessing, maxFiles = 5 }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `"${file.name}" is too large. Max ${MAX_MB}MB allowed.`;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXT.includes(ext)) return `"${file.name}" has an unsupported format.`;
    return null;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of list) {
      const err = validate(file);
      if (err) { errors.push(err); continue; }
      // Skip duplicates (same name + size)
      const isDup = files.some(f => f.name === file.name && f.size === file.size) ||
        valid.some(f => f.name === file.name && f.size === file.size);
      if (!isDup) valid.push(file);
    }

    const remaining = maxFiles - files.length;
    if (valid.length > remaining) {
      errors.push(`You can upload up to ${maxFiles} files. Only the first ${remaining} were added.`);
    }

    const toAdd = valid.slice(0, remaining);
    if (toAdd.length > 0) onFilesChange([...files, ...toAdd]);
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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canAddMore = files.length < maxFiles;

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        multiple
        onChange={onInputChange}
        style={{ display: 'none' }}
      />

      {/* Dropzone — shown when no files OR as compact add bar when files exist */}
      {files.length === 0 ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? '#eff6ff' : '#f8fafc',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: dragOver ? '#dbeafe' : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Upload size={28} color={dragOver ? '#2563eb' : '#64748b'} />
          </div>

          <p style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
            {dragOver ? 'Drop your protocols here' : 'Upload Protocol Documents'}
          </p>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Drag & drop or click to browse · up to {maxFiles} files
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['PDF', 'DOCX', 'TXT'].map(fmt => (
              <span key={fmt} style={{
                padding: '4px 12px', borderRadius: 20,
                background: '#e2e8f0', color: '#475569',
                fontSize: 12, fontWeight: 600,
              }}>{fmt}</span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>Maximum {MAX_MB}MB per file</p>
        </div>
      ) : (
        <div>
          {/* File list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} style={{
                border: '1.5px solid #e2e8f0', borderRadius: 12,
                padding: '14px 18px', background: '#f8fafc',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: '#dbeafe', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <FileText size={20} color="#2563eb" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </p>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {formatSize(file.size)} · {file.name.split('.').pop()?.toUpperCase()}
                  </p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => removeFile(index)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, color: '#94a3b8', flexShrink: 0,
                    }}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add more bar */}
          {canAddMore && !isProcessing && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              style={{
                marginTop: 10,
                border: `1.5px dashed ${dragOver ? '#2563eb' : '#cbd5e1'}`,
                borderRadius: 12, padding: '12px 18px',
                cursor: 'pointer', background: dragOver ? '#eff6ff' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease',
              }}
            >
              <Plus size={16} color="#2563eb" />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                Add another file ({files.length}/{maxFiles})
              </span>
            </div>
          )}

          {!canAddMore && (
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
              Maximum of {maxFiles} files reached.
            </p>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
