"use client";

import { useRef } from "react";

/**
 * Photo input for apartments. Upload only: an agency's listings should show
 * their own units, so there is no bundled library to pick a stock interior
 * from. Files go straight to the private Storage bucket.
 */

/**
 * Read a picked file as a data URL so the image appears immediately. The
 * upload to Storage happens in parallel, and the signed URL replaces this on
 * the next load.
 */
export function readFiles(files: FileList | null, onEach: (src: string) => void) {
  if (!files) return;
  for (const file of Array.from(files)) {
    const reader = new FileReader();
    reader.onload = () => onEach(String(reader.result));
    reader.readAsDataURL(file);
  }
}

export function UploadButton({
  label,
  multiple = false,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  onFiles: (files: FileList | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-azure-900/20 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/20 dark:text-soft-500 dark:hover:bg-white/5"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21V9M8 13l4-4 4 4M4 3h16" />
        </svg>
        {label}
      </button>
    </>
  );
}

/**
 * Multi photo field: upload from the device, then review or remove what is
 * queued. The first one becomes the unit's cover.
 */
export function MultiPhotoPicker({
  value,
  onChange,
  uploadLabel,
  emptyLabel,
  removeLabel,
  coverLabel,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  uploadLabel: string;
  emptyLabel: string;
  removeLabel: string;
  coverLabel: string;
}) {
  return (
    <div className="space-y-3">
      <UploadButton
        label={uploadLabel}
        multiple
        onFiles={(files) => {
          const added: string[] = [];
          readFiles(files, (src) => {
            added.push(src);
            onChange([...value, ...added]);
          });
        }}
      />

      {value.length === 0 ? (
        <p className="rounded-2xl border border-azure-900/10 px-4 py-3 text-xs text-onyx/45 dark:border-white/10 dark:text-white/45">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {value.map((src, i) => (
            <figure key={`${src}-${i}`} className="relative h-20 w-28 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <figcaption className="absolute inset-x-0 bottom-0 bg-onyx/75 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-white">
                  {coverLabel}
                </figcaption>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, n) => n !== i))}
                aria-label={removeLabel}
                title={removeLabel}
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-onyx transition hover:bg-red-500 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
