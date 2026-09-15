import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GroqProvider } from "../src/ai/providers/groq.provider.js";
import { MockAIProvider } from "../src/ai/providers/mock.provider.js";
import { getAIProvider, setAIProvider } from "../src/ai/providers/index.js";
import { z } from "zod";
import { AppError } from "../src/errors/index.js";

describe("Groq Provider & AI Provider Abstraction", () => {
  let originalProvider: any;

  beforeEach(() => {
    originalProvider = getAIProvider();
  });

  afterEach(() => {
    setAIProvider(originalProvider);
  });

  it("instantiates GroqProvider with correct model info", () => {
    const provider = new GroqProvider("gsk-test-key", "openai/gpt-oss-120b");
    const info = provider.getModelInfo();

    expect(info.provider).toBe("groq");
    expect(info.modelName).toBe("openai/gpt-oss-120b");
    expect(info.maxContextTokens).toBe(131072);
    expect(info.costPer1kInputTokensUsd).toBeGreaterThan(0);
    expect(info.costPer1kOutputTokensUsd).toBeGreaterThan(0);
  });

  it("supports provider switching via setAIProvider without agent modifications", () => {
    const mock = new MockAIProvider("test-mock");
    setAIProvider(mock);
    expect(getAIProvider().getModelInfo().provider).toBe("mock");

    const groq = new GroqProvider("gsk-test", "openai/gpt-oss-120b");
    setAIProvider(groq);
    expect(getAIProvider().getModelInfo().provider).toBe("groq");
  });

  it("GroqProvider normalizes 429 rate limit errors to user-friendly AppError", async () => {
    const provider = new GroqProvider("gsk-test-key");
    // Mock the internal client chat completions to reject with 429
    (provider as any).client = {
      chat: {
        completions: {
          create: async () => {
            const err: any = new Error("Rate limit exceeded");
            err.status = 429;
            throw err;
          },
        },
      },
    };

    const schema = z.object({ value: z.string() });
    await expect(
      provider.generateStructuredOutput({
        prompt: "test",
        schema,
        schemaName: "TestSchema",
      }),
    ).rejects.toThrow(/rate limit reached/i);
  });

  it("GroqProvider normalizes timeout errors", async () => {
    const provider = new GroqProvider("gsk-test-key");
    (provider as any).client = {
      chat: {
        completions: {
          create: async () => {
            const err: any = new Error("Connection timed out");
            err.code = "ETIMEDOUT";
            throw err;
          },
        },
      },
    };

    const schema = z.object({ value: z.string() });
    await expect(
      provider.generateStructuredOutput({
        prompt: "test",
        schema,
        schemaName: "TestSchema",
      }),
    ).rejects.toThrow(/timed out/i);
  });

  it("GroqProvider validates structured output through Zod and rejects malformed JSON", async () => {
    const provider = new GroqProvider("gsk-test-key");
    (provider as any).client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "{ invalid json here" } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        },
      },
    };

    const schema = z.object({ title: z.string() });
    await expect(
      provider.generateStructuredOutput({
        prompt: "test",
        schema,
        schemaName: "TestSchema",
      }),
    ).rejects.toThrow(/invalid JSON/i);
  });

  it("GroqProvider validates structured output through Zod and rejects schema mismatches", async () => {
    const provider = new GroqProvider("gsk-test-key");
    (provider as any).client = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              { message: { content: JSON.stringify({ wrongField: 123 }) } },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
        },
      },
    };

    const schema = z.object({ requiredField: z.string() });
    await expect(
      provider.generateStructuredOutput({
        prompt: "test",
        schema,
        schemaName: "TestSchema",
      }),
    ).rejects.toThrow(/did not match expected structure/i);
  });
});
