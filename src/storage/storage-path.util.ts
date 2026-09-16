import path from "node:path";
import { AppError } from "../errors/index.js";

/**
 * Sanitizes a filename for object storage to prevent path traversal and illegal characters.
 * Preserves the file extension and guarantees non-empty filename.
 */
export function sanitizeFilenameForStorage(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "document.bin";
  }

  // Extract raw extension if present
  const rawExt = path.extname(filename);
  const baseWithoutExt = path.basename(filename, rawExt);
  const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 10);

  // Strip path traversal and non-safe characters
  const sanitizedBase = baseWithoutExt
    .replace(/\.\.+/g, "")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  const finalBase = sanitizedBase || "document";

  return `${finalBase}${safeExt}`;
}

/**
 * Asserts that a storage key is well-formed, relative, and does not attempt path traversal.
 */
export function assertSafeStorageKey(key: string): void {
  if (!key || typeof key !== "string") {
    throw AppError.badRequest("Invalid storage key: key must be a non-empty string.");
  }

  // Disallow path traversal components
  if (
    key.includes("..") ||
    key.includes("\\") ||
    key.startsWith("/") ||
    key.includes("\0")
  ) {
    throw AppError.badRequest("Path traversal or illegal characters detected in storage key.");
  }

  // Ensure normalized path doesn't escape root
  const normalized = path.posix.normalize(key);
  if (normalized.startsWith("..") || normalized.startsWith("/")) {
    throw AppError.badRequest("Path traversal detected in storage key.");
  }
}

/**
 * Constructs a secure user-scoped storage key for uploaded resume imports.
 * Pattern: imports/{userId}/{importId}/{sanitizedFilename}
 */
export function buildImportStorageKey(
  userId: string,
  importId: string,
  originalFilename: string,
): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const safeImportId = importId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const safeFilename = sanitizeFilenameForStorage(originalFilename);

  const key = `imports/${safeUserId}/${safeImportId}/${safeFilename}`;
  assertSafeStorageKey(key);
  return key;
}

/**
 * Verifies that a storage key belongs to the specified user.
 * Supports both `imports/{userId}/...` and `users/{userId}/...` conventions.
 */
export function validateStorageKeyOwnership(key: string, userId: string): boolean {
  try {
    assertSafeStorageKey(key);
  } catch {
    return false;
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const parts = key.split("/");

  // Check imports/{userId}/...
  if (parts[0] === "imports" && parts[1] === safeUserId) {
    return true;
  }

  // Check users/{userId}/...
  if (parts[0] === "users" && parts[1] === safeUserId) {
    return true;
  }

  return false;
}
