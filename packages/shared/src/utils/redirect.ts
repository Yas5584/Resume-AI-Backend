/**
 * Sanitizes redirect URLs to prevent Open Redirect vulnerabilities (CWE-601).
 * Only permits valid relative paths within the application.
 */
export function getSafeRedirect(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "/dashboard";

  const trimmed = url.trim();

  // Prevent protocol-relative URLs (//evil.com), scheme injection (javascript:, https:),
  // backslash bypasses (/\evil.com), and redirect loops back to auth routes.
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes(":") ||
    trimmed.startsWith("/login") ||
    trimmed.startsWith("/register")
  ) {
    return "/dashboard";
  }

  return trimmed;
}
