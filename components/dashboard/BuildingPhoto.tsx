"use client";

import Image from "next/image";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { PhotoPlaceholder } from "./ui";
import { Modal } from "./Modal";
import { UploadButton, readFiles } from "./PhotoPicker";

/**
 * The building's own photograph. Hovering reveals the controls, so the image
 * stays the subject and the editing stays out of the way until wanted.
 */
export function BuildingPhoto({
  buildingId,
  photo,
  name,
  className = "",
}: {
  buildingId: string;
  photo: string;
  name: string;
  className?: string;
}) {
  const { t } = useI18n();
  const { setBuildingPhoto, removeBuildingPhoto, notify } = useStore();
  const b = t.dash.buildingPhoto;

  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState(false);

  return (
    <div className={`group/bphoto relative ${className}`}>
      {photo ? (
        <Image src={photo} alt={name} fill className="object-cover" />
      ) : (
        <PhotoPlaceholder className="absolute inset-0 h-full w-full" />
      )}

      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-onyx/55 opacity-0 backdrop-blur-sm transition group-hover/bphoto:opacity-100">
        <button
          onClick={() => setPicking(true)}
          className="rounded-full bg-white px-4 py-2 text-xs font-bold text-onyx transition hover:bg-soft-500"
        >
          {photo ? b.replace : b.add}
        </button>
        {photo && (
          <button
            onClick={() => setRemoving(true)}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-onyx transition hover:bg-red-500 hover:text-white"
          >
            {b.remove}
          </button>
        )}
      </div>

      {picking && (
        <Modal title={b.modalTitle} subtitle={name} onClose={() => setPicking(false)}>
          <UploadButton
            label={t.dash.gallery.addModal.upload}
            onFiles={(files) =>
              readFiles(files, (src) => {
                setBuildingPhoto(buildingId, src);
                notify(b.updated);
                setPicking(false);
              })
            }
          />
        </Modal>
      )}

      {removing && (
        <Modal title={b.removeTitle} subtitle={b.removeBody} onClose={() => setRemoving(false)}>
          <div className="flex gap-3">
            <button
              onClick={() => {
                removeBuildingPhoto(buildingId);
                notify(b.removed);
                setRemoving(false);
              }}
              className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              {b.remove}
            </button>
            <button
              onClick={() => setRemoving(false)}
              className="rounded-full border border-azure-900/15 px-6 py-3 text-sm font-semibold text-azure-800 transition hover:bg-azure-900/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {t.dash.common.cancel}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
