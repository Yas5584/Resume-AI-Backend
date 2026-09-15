import { describe, it, expect } from "vitest";
import { getSafeRedirect } from "../src/utils/redirect.js";

describe("Open Redirect Security Sanitization (getSafeRedirect)", () => {
  it("should return /dashboard for null, undefined, or empty string", () => {
    expect(getSafeRedirect(null)).toBe("/dashboard");
    expect(getSafeRedirect(undefined)).toBe("/dashboard");
    expect(getSafeRedirect("")).toBe("/dashboard");
    expect(getSafeRedirect("   ")).toBe("/dashboard");
  });

  it("should permit safe internal relative paths", () => {
    expect(getSafeRedirect("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("/resumes")).toBe("/resumes");
    expect(getSafeRedirect("/resumes/new")).toBe("/resumes/new");
    expect(getSafeRedirect("/settings")).toBe("/settings");
    expect(getSafeRedirect("/jobs/12345")).toBe("/jobs/12345");
  });

  it("should reject external URLs (http, https)", () => {
    expect(getSafeRedirect("https://evil.example.com")).toBe("/dashboard");
    expect(getSafeRedirect("http://evil.example.com")).toBe("/dashboard");
    expect(getSafeRedirect("https://evil.example.com/login")).toBe(
      "/dashboard",
    );
  });

  it("should reject protocol-relative URLs (//evil.example.com)", () => {
    expect(getSafeRedirect("//evil.example.com")).toBe("/dashboard");
    expect(getSafeRedirect("//evil.example.com/path")).toBe("/dashboard");
  });

  it("should reject backslash bypass attempts", () => {
    expect(getSafeRedirect("/\\evil.example.com")).toBe("/dashboard");
    expect(getSafeRedirect("\\evil.example.com")).toBe("/dashboard");
  });

  it("should reject javascript: and data: pseudo-protocols", () => {
    expect(getSafeRedirect("javascript:alert(1)")).toBe("/dashboard");
    expect(getSafeRedirect("javascript:void(0)")).toBe("/dashboard");
    expect(getSafeRedirect("data:text/html,<script>alert(1)</script>")).toBe(
      "/dashboard",
    );
  });

  it("should reject redirect loops back to auth pages", () => {
    expect(getSafeRedirect("/login")).toBe("/dashboard");
    expect(getSafeRedirect("/register")).toBe("/dashboard");
    expect(getSafeRedirect("/login?foo=bar")).toBe("/dashboard");
  });
});
