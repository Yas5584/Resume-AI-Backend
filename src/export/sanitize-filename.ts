/**
 * Sanitizes a title string into a safe, valid filesystem and download filename.
 * Prevents path traversal, illegal characters, and header injection.
 */
export function sanitizeFilename(
  title: string | undefined | null,
  ext: "pdf" | "docx",
): string {
  if (!title || typeof title !== "string") {
    return `Resume.${ext}`;
  }

  // 1. Remove path traversal characters (../, ..\, etc.)
  let sanitized = title.replace(/\.\.+[/\\]?/g, "");

  // 2. Remove characters reserved in Windows / Linux filesystems and header values
  // (< > : " / \ | ? * and control chars)
  sanitized = sanitized.replace(/[<>:"/\\|?*\x00-\x1F]/g, " ");

  // 3. Remove non-ASCII characters to guarantee HTTP header safety (prevent ERR_INVALID_CHAR)
  sanitized = sanitized.replace(/[^\x20-\x7E]/g, "-");

  // 4. Normalize whitespace and hyphens
  sanitized = sanitized
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .replace(/[-.]+$/, "");

  // 4. Truncate to safe length (max 60 chars)
  if (sanitized.length > 60) {
    sanitized = sanitized.substring(0, 60).replace(/[-.]+$/, "");
  }

  // 5. Fallback if title resolved to empty
  if (!sanitized) {
    sanitized = "Resume";
  }

  return `${sanitized}.${ext}`;
}
