"use client";

import { useState } from "react";
import { useBuildingOptional } from "@/lib/building-context";
import { useStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n/context";
import { Field, Modal, ModalActions, fieldCls } from "./Modal";

/**
 * Creating a building, from wherever the button lives.
 *
 * Reachable from two places that must behave identically: the entry at the
 * foot of the building switcher, and the button beside it in the top bar. One
 * component rather than two copies, so the form cannot drift between them.
 *
 * On success the whole dashboard moves to the new building, which is where
 * whoever just created it is going next.
 */
export function AddBuildingModal({ onClose }: { onClose: () => void }) {
  const { building, setBuildingId } = useBuildingOptional();
  const { addBuilding, notify } = useStore();
  const { t, f } = useI18n();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      title={t.dash.shell.addBuilding}
      subtitle={t.dash.shell.addBuildingSubtitle}
      onClose={onClose}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const name = String(data.get("name") ?? "").trim();
          const address = String(data.get("address") ?? "").trim();
          const city = String(data.get("city") ?? "").trim();
          if (!name) {
            setError(t.dash.common.required);
            return;
          }
          setSaving(true);
          const id = await addBuilding({ name, address, city });
          setSaving(false);
          if (!id) return;
          setBuildingId(id);
          notify(f(t.dash.onboarding.created, { name }));
          onClose();
        }}
        className="space-y-4"
      >
        <Field label={t.dash.onboarding.name} error={error}>
          <input name="name" placeholder={t.dash.onboarding.namePlaceholder} className={fieldCls} />
        </Field>
        <Field label={t.dash.onboarding.address}>
          <input name="address" placeholder={t.dash.onboarding.addressPlaceholder} className={fieldCls} />
        </Field>
        <Field label={t.dash.onboarding.city}>
          {/* A portfolio usually grows in its own town. */}
          <input name="city" defaultValue={building?.city ?? "Conakry"} className={fieldCls} />
        </Field>
        <ModalActions
          onCancel={onClose}
          submitLabel={saving ? t.dash.common.saving : t.dash.onboarding.submit}
        />
      </form>
    </Modal>
  );
}
