"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import type { ApartmentPhoto } from "@/lib/data";
import { Card, CardTitle } from "./ui";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";

/** Photos bundled with the app, offered as a picker alongside file upload. */
const LIBRARY = [
  "/photos/interior-1.jpg",
  "/photos/interior-2.jpg",
  "/photos/interior-3.jpg",
  "/photos/interior-4.jpg",
  "/photos/building-1.jpg",
  "/photos/building-2.jpg",
  "/photos/building-3.jpg",
  "/photos/city.jpg",
];

function PhotoForm({
  mode,
  photo,
  onSubmit,
  onClose,
}: {
  mode: "add" | "edit";
  photo?: ApartmentPhoto;
  onSubmit: (src: string, caption: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const g = t.dash.gallery;
  const m = mode === "add" ? g.addModal : g.editModal;

  const [src, setSrc] = useState(photo?.src ?? LIBRARY[0]);
  const [caption, setCaption] = useState(photo?.caption ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    // Read as a data URL so the new image shows immediately. With Supabase
    // Storage wired up this becomes an upload that returns a storage path.
    const reader = new FileReader();
    reader.onload = () => setSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <Modal title={m.title} subtitle={m.subtitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(src, caption.trim());
        }}
        className="space-y-4"
      >
        <div className="relative h-44 overflow-hidden rounded-2xl border border-azure-900/10 dark:border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="h-full w-full object-cover" />
        </div>

        <Field label={g.addModal.source}>
          <div className="flex flex-wrap gap-2">
            {LIBRARY.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSrc(option)}
                className={`h-14 w-20 overflow-hidden rounded-xl border-2 transition ${
                  src === option
                    ? "border-azure-800 dark:border-soft-500"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <Image src={option} alt="" width={160} height={112} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </Field>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-azure-900/20 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/20 dark:text-soft-500 dark:hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V9M8 13l4-4 4 4M4 3h16" />
            </svg>
            {g.addModal.upload}
          </button>
        </div>

        <Field label={g.caption}>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={g.captionPlaceholder}
            className={fieldCls}
          />
        </Field>

        <ModalActions onCancel={onClose} submitLabel={m.submit} />
      </form>
    </Modal>
  );
}

export function PhotoGallery({
  buildingId,
  apartmentId,
}: {
  buildingId: string;
  apartmentId: string;
}) {
  const { t } = useI18n();
  const { photosFor, addPhoto, updatePhoto, deletePhoto, notify } = useStore();
  const g = t.dash.gallery;

  const photos = photosFor(buildingId, apartmentId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ApartmentPhoto | null>(null);
  const [removing, setRemoving] = useState<ApartmentPhoto | null>(null);

  return (
    <Card>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-bold text-azure-950 dark:text-white">{g.title}</h2>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 rounded-full bg-onyx px-4 py-2 text-xs font-semibold text-white transition hover:bg-azure-900 dark:bg-soft-500 dark:text-azure-950 dark:hover:bg-soft-400"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {g.add}
        </button>
      </div>

      {photos.length === 0 ? (
        <p className="py-8 text-center text-sm text-onyx/45 dark:text-white/45">{g.empty}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <figure
              key={photo.id}
              className="group/photo overflow-hidden rounded-2xl border border-azure-900/8 dark:border-white/8"
            >
              <div className="relative h-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.caption ?? ""} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-onyx/55 opacity-0 backdrop-blur-sm transition group-hover/photo:opacity-100">
                  <button
                    onClick={() => setEditing(photo)}
                    aria-label={g.replace}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-onyx transition hover:bg-soft-500"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setRemoving(photo)}
                    aria-label={g.deleteConfirm.submit}
                    className="grid h-9 w-9 place-items-center rounded-full bg-white text-onyx transition hover:bg-red-500 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
              {photo.caption && (
                <figcaption className="px-3 py-2 text-xs text-onyx/55 dark:text-white/50">
                  {photo.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}

      {adding && (
        <PhotoForm
          mode="add"
          onClose={() => setAdding(false)}
          onSubmit={(src, caption) => {
            addPhoto(buildingId, apartmentId, src, caption || undefined);
            notify(g.addModal.added);
            setAdding(false);
          }}
        />
      )}

      {editing && (
        <PhotoForm
          mode="edit"
          photo={editing}
          onClose={() => setEditing(null)}
          onSubmit={(src, caption) => {
            updatePhoto(buildingId, apartmentId, editing.id, { src, caption });
            notify(g.editModal.updated);
            setEditing(null);
          }}
        />
      )}

      {removing && (
        <Modal
          title={g.deleteConfirm.title}
          subtitle={g.deleteConfirm.subtitle}
          onClose={() => setRemoving(null)}
        >
          <div className="relative h-40 overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={removing.src} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                deletePhoto(buildingId, apartmentId, removing.id);
                notify(g.deleteConfirm.deleted);
                setRemoving(null);
              }}
              className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {g.deleteConfirm.submit}
            </button>
            <button
              onClick={() => setRemoving(null)}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        </Modal>
      )}

    </Card>
  );
}
