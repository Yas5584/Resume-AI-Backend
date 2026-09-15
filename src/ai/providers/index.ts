import { AIProvider } from "./ai-provider.interface.js";
import { OpenAIProvider } from "./openai.provider.js";
import { GroqProvider } from "./groq.provider.js";
import { MockAIProvider } from "./mock.provider.js";
import { env } from "../../config/index.js";

export * from "./ai-provider.interface.js";
export * from "./openai.provider.js";
export * from "./groq.provider.js";
export * from "./mock.provider.js";

let defaultProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (defaultProvider) return defaultProvider;

  if (
    env.AI_USE_MOCK ||
    env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "test"
  ) {
    defaultProvider = new MockAIProvider("mock-ai");
    return defaultProvider;
  }

  if (env.AI_PROVIDER === "groq") {
    if (!env.GROQ_API_KEY || env.GROQ_API_KEY.includes("placeholder")) {
      defaultProvider = new MockAIProvider("mock-groq-gpt-oss-120b");
    } else {
      defaultProvider = new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL);
    }
  } else if (env.AI_PROVIDER === "openai") {
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.includes("placeholder")) {
      defaultProvider = new MockAIProvider("mock-gpt-4o");
    } else {
      defaultProvider = new OpenAIProvider(
        env.OPENAI_API_KEY,
        env.AI_DEFAULT_MODEL,
      );
    }
  } else {
    defaultProvider = new MockAIProvider("mock-ai");
  }

  return defaultProvider;
}

export function setAIProvider(provider: AIProvider | null) {
  defaultProvider = provider;
}
