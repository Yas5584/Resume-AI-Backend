import {
  ResumeData,
  ResumeQualityFinding,
  ResumeQualityCategory,
  FindingSeverity,
} from "@resumeai/shared";
import { DeterministicCheckResult } from "../types.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /[\d+()\-.\s]{7,}/;

/**
 * Validates syntax of a URL or URI scheme without performing external network calls.
 * Supports:
 * - http:// and https://
 * - mailto: (validated with email syntax)
 * - tel: (validated with phone syntax)
 * - domain strings (e.g. linkedin.com/in/user, github.com/user)
 */
export function isValidUrlSyntax(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim();
  if (!trimmed) return false;

  // Exact empty prefixes are invalid
  if (
    trimmed === "https://" ||
    trimmed === "http://" ||
    trimmed === "mailto:" ||
    trimmed === "tel:"
  ) {
    return false;
  }

  // Support mailto:
  if (trimmed.toLowerCase().startsWith("mailto:")) {
    const emailPart = trimmed.slice(7).trim();
    return EMAIL_REGEX.test(emailPart);
  }

  // Support tel:
  if (trimmed.toLowerCase().startsWith("tel:")) {
    const phonePart = trimmed.slice(4).trim();
    return phonePart.length >= 7 && PHONE_REGEX.test(phonePart);
  }

  // Standard http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return Boolean(
        parsed.hostname &&
          parsed.hostname.includes(".") &&
          !parsed.hostname.startsWith(".") &&
          !parsed.hostname.endsWith(".")
      );
    } catch {
      return false;
    }
  }

  // Bare domains without protocol (e.g. linkedin.com/in/user, github.com/user)
  // Ensure it has no spaces, contains a dot with at least 2 chars in domain
  if (!trimmed.includes(" ") && trimmed.includes(".")) {
    try {
      const parsed = new URL(`https://${trimmed}`);
      return Boolean(
        parsed.hostname &&
          parsed.hostname.includes(".") &&
          !parsed.hostname.startsWith(".") &&
          !parsed.hostname.endsWith(".") &&
          parsed.hostname.split(".").pop()!.length >= 2
      );
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Validates candidate contact info completeness and URL syntax.
 * No external network requests are made.
 */
export function checkContactAndLinks(data: ResumeData): DeterministicCheckResult {
  const findings: ResumeQualityFinding[] = [];
  let passed = 0;
  let total = 0;

  const info = data.personalInfo || {};

  // 1. Full Name (Required: CRITICAL)
  total++;
  const hasName = typeof info.fullName === "string" && info.fullName.trim().length >= 2;
  if (hasName) {
    passed++;
  } else {
    findings.push({
      id: "contact-missing-name",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.CRITICAL,
      title: "Missing full name",
      description: "No full name provided in contact information.",
      whyItMatters: "An ATS cannot index or process your application without a candidate name.",
      recommendation: "Provide your official first and last name.",
      section: "personalInfo",
      field: "fullName",
    });
  }

  // 2. Email Verification (Required: CRITICAL, supports mailto:)
  total++;
  let email = (info.email || "").trim();
  if (email.toLowerCase().startsWith("mailto:")) {
    email = email.slice(7).trim();
  }
  const hasValidEmail = EMAIL_REGEX.test(email);
  if (hasValidEmail) {
    passed++;
  } else if (!email) {
    findings.push({
      id: "contact-missing-email",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.CRITICAL,
      title: "Missing contact email",
      description: "An email address is required for recruiter outreach.",
      whyItMatters: "Email is the primary identifier used by ATS systems to communicate with applicants.",
      recommendation: "Add a professional email address (e.g. name@domain.com).",
      section: "personalInfo",
      field: "email",
    });
  } else {
    findings.push({
      id: "contact-invalid-email",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.CRITICAL,
      title: "Invalid email format",
      description: `The provided email "${email}" is syntactically invalid.`,
      whyItMatters: "Automated ATS interview invites and notifications will fail to deliver.",
      recommendation: "Ensure email conforms to a standard format (e.g. yourname@example.com).",
      section: "personalInfo",
      field: "email",
      evidence: email,
    });
  }

  // 3. Phone Number Verification (Recommended: MEDIUM)
  total++;
  let phone = (info.phone || (info as any).phoneNumber || "").trim();
  if (phone.toLowerCase().startsWith("tel:")) {
    phone = phone.slice(4).trim();
  }
  const hasValidPhone = phone.length >= 7 && PHONE_REGEX.test(phone);
  if (hasValidPhone) {
    passed++;
  } else if (!phone) {
    findings.push({
      id: "contact-missing-phone",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.MEDIUM,
      title: "Missing phone number",
      description: "No contact phone number provided.",
      whyItMatters: "Recruiters frequently call or text for initial screening schedules.",
      recommendation: "If available, add a direct contact phone number with country/area code.",
      section: "personalInfo",
      field: "phone",
    });
  } else {
    findings.push({
      id: "contact-invalid-phone",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.MEDIUM,
      title: "Unusual phone format",
      description: `The phone number "${phone}" may not follow standard formatting.`,
      whyItMatters: "ATS parsers may fail to extract phone numbers with irregular punctuation.",
      recommendation: "Format your phone number clearly, e.g., +1 (555) 012-3456.",
      section: "personalInfo",
      field: "phone",
      evidence: phone,
    });
  }

  // 4. Location Verification (Optional/Recommended: LOW)
  total++;
  const location = (info.location || "").trim();
  const hasLocation = location.length >= 2;
  if (hasLocation) {
    passed++;
  } else {
    findings.push({
      id: "contact-missing-location",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.LOW,
      title: "Missing location",
      description: "No city, state, or country specified.",
      whyItMatters: "Many ATS filters screen candidates by geographic proximity or work authorization regions.",
      recommendation: "Consider adding your city and state/country (e.g. San Francisco, CA).",
      section: "personalInfo",
      field: "location",
    });
  }

  // 5. Professional Links Syntax Validation (LinkedIn, GitHub, Portfolio)
  total++;
  const urlsToCheck: { field: string; label: string; url?: string | null; roleDependent?: boolean }[] = [
    { field: "linkedin", label: "LinkedIn profile", url: info.linkedin || info.linkedinUrl },
    { field: "github", label: "GitHub profile", url: info.github || info.githubUrl, roleDependent: true },
    { field: "website", label: "Portfolio website", url: info.website || info.portfolioUrl, roleDependent: true },
  ];

  let invalidUrls = 0;
  let hasProfessionalLink = false;

  for (const item of urlsToCheck) {
    if (item.url && item.url.trim()) {
      hasProfessionalLink = true;
      if (!isValidUrlSyntax(item.url.trim())) {
        invalidUrls++;
        findings.push({
          id: `contact-invalid-url-${item.field}`,
          category: ResumeQualityCategory.CONTACT_LINKS,
          severity: FindingSeverity.LOW,
          title: `Syntactically invalid ${item.label}`,
          description: `The link "${item.url}" does not appear to be a valid web address.`,
          whyItMatters: "Recruiters clicking links in digital resumes will encounter broken addresses.",
          recommendation: `Check the ${item.label} link format (e.g. https://${item.field}.com/yourhandle).`,
          section: "personalInfo",
          field: item.field,
          evidence: item.url,
        });
      }
    }
  }

  // Also check custom links array (supports mailto:, tel:, http://, https://, domains)
  if (Array.isArray(data.links)) {
    for (const link of data.links) {
      if (link.url && link.url.trim()) {
        hasProfessionalLink = true;
        if (!isValidUrlSyntax(link.url.trim())) {
          invalidUrls++;
          findings.push({
            id: `contact-invalid-custom-link-${link.id}`,
            category: ResumeQualityCategory.CONTACT_LINKS,
            severity: FindingSeverity.LOW,
            title: `Invalid custom link: ${link.label || "Link"}`,
            description: `The URL "${link.url}" is syntactically invalid.`,
            whyItMatters: "Broken links detract from resume professionalism.",
            recommendation: "Ensure link points to a valid web address or supported URI scheme (http, https, mailto, tel).",
            section: "links",
            itemId: link.id,
            evidence: link.url,
          });
        }
      }
    }
  }

  if (invalidUrls === 0) {
    passed++;
  }

  // LinkedIn is recommended (MEDIUM severity)
  const linkedinUrl = info.linkedin || info.linkedinUrl;
  if (!linkedinUrl || !linkedinUrl.trim()) {
    findings.push({
      id: "contact-missing-linkedin",
      category: ResumeQualityCategory.CONTACT_LINKS,
      severity: FindingSeverity.MEDIUM,
      title: "LinkedIn profile not linked",
      description: "No LinkedIn URL was detected in your contact information.",
      whyItMatters: "Over 90% of technical and corporate recruiters cross-reference LinkedIn profiles.",
      recommendation: "Consider adding your LinkedIn URL to increase professional credibility.",
      section: "personalInfo",
      field: "linkedin",
    });
  }

  return {
    category: ResumeQualityCategory.CONTACT_LINKS,
    findings,
    passedChecksCount: passed,
    totalChecksCount: total,
    metrics: {
      hasName,
      hasValidEmail,
      hasValidPhone,
      hasLocation,
      hasProfessionalLink,
      invalidUrls,
    },
  };
}
