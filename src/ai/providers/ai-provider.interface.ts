import { z } from "zod";

export interface AIModelInfo {
  provider: "openai" | "anthropic" | "mock" | string;
  modelName: string;
  maxContextTokens: number;
  costPer1kInputTokensUsd: number;
  costPer1kOutputTokensUsd: number;
}

export interface StructuredOutputParams<T> {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodType<T>;
  schemaName: string;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIStructuredResponse<T> {
  data: T;
  rawText: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface TextGenerationParams {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AITextResponse {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface AIProvider {
  getModelInfo(): AIModelInfo;
  generateStructuredOutput<T>(
    params: StructuredOutputParams<T>,
  ): Promise<AIStructuredResponse<T>>;
  generateText(params: TextGenerationParams): Promise<AITextResponse>;
}
