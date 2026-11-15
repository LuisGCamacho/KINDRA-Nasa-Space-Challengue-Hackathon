import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Detection } from "@/lib/alert-types";
import { ANNOTATED_CID } from "./alert-email-html";

/** Las imágenes que escribe Python quedan en `web/public/live/frames/` (fuera de Git). */
const FRAMES_DIR = path.join(process.cwd(), "public", "live", "frames");

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  /** Solo en la imagen que va dentro del cuerpo del correo. */
  contentId?: string;
}

/** Lee un cuadro por su nombre de archivo; `null` si Python todavía no lo escribió. */
async function readFrame(url: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(FRAMES_DIR, path.basename(url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/**
 * Adjuntos del correo: la imagen marcada va dos veces, en el cuerpo (Content-ID) y como adjunto
 * para guardarla; la original va adjunta para comparar sin las marcas. Si falta una imagen,
 * se omite: el correo sale igual.
 */
export async function buildImageAttachments(detection: Detection): Promise<EmailAttachment[]> {
  const [annotated, original] = await Promise.all([readFrame(detection.annotatedUrl), readFrame(detection.frameUrl)]);
  const attachments: EmailAttachment[] = [];
  if (annotated) {
    attachments.push({ filename: "deteccion-marcada.jpg", content: annotated, contentId: ANNOTATED_CID });
    attachments.push({ filename: "deteccion-marcada-adjunta.jpg", content: annotated });
  }
  if (original) attachments.push({ filename: "cuadro-original.jpg", content: original });
  return attachments;
}
