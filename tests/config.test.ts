import { describe, it, expect } from "vitest";
import { z } from "zod";

const TestEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_PORT: z.coerce.number().min(1024).max(65535),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().startsWith("postgresql://"),
});

describe("Environment Configuration Validation", () => {
  it("should accept valid configuration parameters", () => {
    const validConfig = {
      NODE_ENV: "test",
      API_PORT: "4000",
      JWT_SECRET: "test-secret-at-least-16-chars-long",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
    };

    const parsed = TestEnvSchema.safeParse(validConfig);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.API_PORT).toBe(4000);
    }
  });

  it("should reject invalid configuration with descriptive error", () => {
    const invalidConfig = {
      NODE_ENV: "invalid_env",
      API_PORT: "999999", // out of range
      JWT_SECRET: "short", // less than 16 chars
      DATABASE_URL: "mysql://localhost:3306/db", // wrong protocol
    };

    const parsed = TestEnvSchema.safeParse(invalidConfig);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      expect(fieldErrors.NODE_ENV).toBeDefined();
      expect(fieldErrors.API_PORT).toBeDefined();
      expect(fieldErrors.JWT_SECRET).toBeDefined();
      expect(fieldErrors.DATABASE_URL).toBeDefined();
    }
  });
});
