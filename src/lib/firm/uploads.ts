import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogueAttachment } from "./types";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "catalogue");
const PUBLIC_PREFIX = "/uploads/catalogue";
const MAX_BYTES = 20 * 1024 * 1024;

function safeName(name: string): string {
  return (
    name
      .split(/[\\/]/)
      .pop()
      ?.replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120) || "file"
  );
}

/** Persist Marketing catalogue attachments and return display metadata. */
export async function saveCatalogueAttachments(
  craneId: string,
  entries: { label: string; file: File }[],
): Promise<CatalogueAttachment[]> {
  if (!entries.length) return [];
  const dir = path.join(UPLOAD_ROOT, craneId);
  await mkdir(dir, { recursive: true });

  const saved: CatalogueAttachment[] = [];
  for (const { label, file } of entries) {
    if (file.size === 0) continue;
    if (file.size > MAX_BYTES) {
      throw new Error(`${file.name} is larger than 20 MB.`);
    }
    const stored = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName(file.name)}`;
    await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));

    saved.push({
      label,
      filename: file.name,
      url: `${PUBLIC_PREFIX}/${encodeURIComponent(craneId)}/${encodeURIComponent(stored)}`,
      size: file.size,
      mime: file.type || "application/octet-stream",
    });
  }
  return saved;
}
