/**
 * Server side validation for uploaded images.
 *
 * `accept="image/*"` is a browser hint and `file.type` is whatever the client
 * chose to say, so neither is a check. This reads the first bytes and decides
 * from the file itself, which is the only part an attacker cannot simply
 * relabel.
 */

/** Comfortably above a phone photograph, far below anything worth hosting. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type Signature = { mime: string; test: (b: Uint8Array) => boolean };

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    // RIFF....WEBP
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export type ImageCheck =
  | { ok: true; mime: string }
  | { ok: false; reason: "empty" | "too-large" | "not-an-image" };

/**
 * Confirms the upload is an image we are willing to store, and returns the
 * type its own bytes claim rather than the one the client declared.
 */
export async function validateImage(file: File): Promise<ImageCheck> {
  if (file.size === 0) return { ok: false, reason: "empty" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too-large" };

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const match = SIGNATURES.find((s) => s.test(header));
  if (!match) return { ok: false, reason: "not-an-image" };

  return { ok: true, mime: match.mime };
}
