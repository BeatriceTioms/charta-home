"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n/context";
import { Field, Modal, ModalActions, fieldCls } from "@/components/dashboard/Modal";

/**
 * Sends one rent reminder, by hand.
 *
 * Until the WhatsApp Business API is approved nothing may message a tenant
 * automatically, so this is how a reminder actually reaches somebody: it opens
 * WhatsApp, or the phone's SMS app, or a mail client, with the message already
 * written. The wording is a starting point and the person sending it knows
 * whether this month calls for a nudge or a firmer note.
 *
 * Shared by the unit page and the rent table, which both offer to chase the
 * same debt and should not do it two different ways.
 */
export
function ReminderModal({
  name,
  amount,
  apartment,
  phone,
  onClose,
  onSent,
}: {
  name: string;
  amount: number;
  apartment: string;
  phone: string;
  onClose: () => void;
  /** Lets the caller mark the row as chased once the message has gone. */
  onSent?: () => void;
}) {
  const { t, f } = useI18n();
  const { notify } = useStore();
  const { fmt } = useMoney();
  const m = t.dash.apartment.reminderModal;
  const [channel, setChannel] = useState("whatsapp");

  // The standard wording is a starting point, not the final word. A late
  // payment is a conversation between people who know each other, and the one
  // sending it is the one who knows whether this month calls for a nudge or a
  // firmer note.
  const [message, setMessage] = useState(() =>
    f(m.message, { name, amount: fmt(amount), apartment })
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (channel === "whatsapp") {
      window.open(
        `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener"
      );
    } else if (channel === "sms") {
      window.location.href = `sms:${phone.replace(/\s/g, "")}?body=${encodeURIComponent(message)}`;
    } else {
      window.location.href = `mailto:?subject=${encodeURIComponent(m.title)}&body=${encodeURIComponent(message)}`;
    }
    onSent?.();
    notify(f(m.sent, { name }));
    onClose();
  };

  return (
    <Modal title={m.title} subtitle={f(m.subtitle, { name })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label={m.channel}>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={fieldCls}>
            <option value="whatsapp">{m.whatsapp}</option>
            <option value="sms">{m.sms}</option>
            <option value="email">{m.email}</option>
          </select>
        </Field>
        <Field label={m.preview} hint={m.previewHint}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            className={`${fieldCls} resize-none leading-relaxed`}
          />
        </Field>
        <ModalActions onCancel={onClose} submitLabel={m.submit} disabled={!message.trim()} />
      </form>
    </Modal>
  );
}
