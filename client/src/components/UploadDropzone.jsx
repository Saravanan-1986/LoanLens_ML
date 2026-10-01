import { useRef, useState } from 'react';
import { FileUp, FileText, X } from 'lucide-react';

import { formatBytes } from '../utils/format';
import { MAX_UPLOAD_MB } from '../utils/constants';

/**
 * Drag-and-drop PDF picker. Validation mirrors the backend (PDF only, 20 MB).
 */
export default function UploadDropzone({ file, onSelect, onClear, disabled = false, error = '' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState('');

  const accept = (candidate) => {
    if (!candidate) return;
    const isPdf =
      candidate.type === 'application/pdf' || /\.pdf$/i.test(candidate.name || '');
    if (!isPdf) {
      setLocalError('Only PDF files are accepted. Please choose a .pdf document.');
      return;
    }
    if (candidate.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setLocalError(`This file is larger than ${MAX_UPLOAD_MB} MB. Please upload a smaller file.`);
      return;
    }
    setLocalError('');
    onSelect(candidate);
  };

  const shownError = error || localError;

  if (file) {
    return (
      <div className="file-pick">
        <div className="file-chip">
          <FileText size={20} />
        </div>
        <div className="grow">
          <div className="strong truncate">{file.name}</div>
          <div className="text-xs muted">{formatBytes(file.size)} • PDF ready to analyse</div>
        </div>
        {!disabled ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClear}>
            <X size={14} />
            Remove
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''}`.trim()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload a loan agreement PDF"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) accept(event.dataTransfer.files?.[0]);
        }}
      >
        <div className="upload-icon">
          <FileUp size={26} strokeWidth={2} />
        </div>
        <div className="upload-title">Upload your loan agreement</div>
        <p className="upload-sub">
          Drag &amp; drop your PDF here
          <br />
          or
        </p>
        <span className="btn btn-secondary">Browse Files</span>
        <p className="text-xs muted" style={{ marginTop: 12 }}>
          Supported format: PDF • Maximum size: {MAX_UPLOAD_MB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>
      {shownError ? <p className="field-error">{shownError}</p> : null}
    </div>
  );
}
