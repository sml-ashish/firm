"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, RotateCcw, UploadCloud } from "lucide-react";

export function FileDropzone({
  file,
  onFile,
  accept = ".xlsx,.xlsm,.xls",
  maxMb = 12,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  maxMb?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function pick(next: File | null) {
    setLocalError(null);
    if (next && next.size > maxMb * 1024 * 1024) {
      setLocalError(`The workbook is larger than ${maxMb} MB.`);
      return;
    }
    onFile(next);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose an Excel workbook"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-9 text-center transition ${
          dragging
            ? "border-brand bg-brand-soft"
            : file
              ? "border-healthy/50 bg-healthy-soft"
              : "border-line-strong bg-panel-2 hover:border-brand hover:bg-brand-soft/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileSpreadsheet size={24} className="text-healthy" />
            <div className="mt-2 text-[12.5px] font-semibold text-ink">{file.name}</div>
            <div className="mt-0.5 text-[12px] text-muted">
              {(file.size / 1024).toFixed(0)} KB · click to choose a different file
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2"
              onClick={(event) => {
                event.stopPropagation();
                onFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <RotateCcw size={12} /> Clear file
            </button>
          </>
        ) : (
          <>
            <UploadCloud size={24} className="text-faint" />
            <div className="mt-2 text-[12.5px] font-semibold text-ink">
              Drop the workbook here, or click to browse
            </div>
            <div className="mt-0.5 text-[12px] text-muted">
              Excel .xlsx up to {maxMb} MB. Nothing is saved until you commit the preview.
            </div>
          </>
        )}
      </div>
      {localError && <p className="mt-1.5 text-[12px] font-medium text-nd-ink">{localError}</p>}
    </div>
  );
}
