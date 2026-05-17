import { useRef, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

const ACCEPTED = '.pdf,.docx,.doc,.txt,.md';
const MAX_MB = 10;

export default function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (file.size > MAX_MB * 1024 * 1024) return `File too large. Max ${MAX_MB}MB allowed.`;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext))
      return 'Unsupported format. Upload PDF, DOCX, or TXT.';
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clear = () => {
    setSelectedFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
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
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            onChange={onInputChange}
            style={{ display: 'none' }}
          />

          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: dragOver ? '#dbeafe' : '#e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Upload size={28} color={dragOver ? '#2563eb' : '#64748b'} />
          </div>

          <p style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
            {dragOver ? 'Drop your protocol here' : 'Upload Protocol Document'}
          </p>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Drag & drop or click to browse
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
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>Maximum file size: {MAX_MB}MB</p>
        </div>
      ) : (
        <div style={{
          border: '2px solid #e2e8f0', borderRadius: 16,
          padding: '20px 24px', background: '#f8fafc',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: '#dbeafe', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FileText size={24} color="#2563eb" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, color: '#1e293b', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedFile.name}
            </p>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              {formatSize(selectedFile.size)} · {selectedFile.name.split('.').pop()?.toUpperCase()}
            </p>
          </div>
          {!isProcessing && (
            <button
              onClick={e => { e.stopPropagation(); clear(); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 4, color: '#94a3b8', flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertCircle size={16} color="#ef4444" />
          <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
