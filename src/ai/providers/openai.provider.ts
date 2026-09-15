import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.js";
import {
  AIProvider,
  AIModelInfo,
  StructuredOutputParams,
  AIStructuredResponse,
  TextGenerationParams,
  AITextResponse,
} from "./ai-provider.interface.js";
import { AppError } from "../../errors/index.js";
import { ErrorCode } from "@resumeai/shared";

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  getModelInfo(): AIModelInfo {
    return {
      provider: "openai",
      modelName: this.model,
      maxContextTokens: 128000,
      costPer1kInputTokensUsd: 0.0025,
      costPer1kOutputTokensUsd: 0.01,
    };
  }

  async generateStructuredOutput<T>(
    params: StructuredOutputParams<T>,
  ): Promise<AIStructuredResponse<T>> {
    try {
      const messages: ChatCompletionMessageParam[] = [];

      if (params.systemPrompt) {
        messages.push({ role: "system", content: params.systemPrompt });
      }

      messages.push({
        role: "user",
        content: `${params.prompt}\n\nStrict requirement: Output must strictly conform to the expected JSON schema: ${params.schemaName}. Output only valid JSON.`,
      });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 4000,
        response_format: { type: "json_object" },
      });

      const choice = completion.choices[0];
      const rawText = choice.message.content ?? "{}";

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (jsonErr) {
        throw new AppError(
          502,
          ErrorCode.AI_PROVIDER_ERROR,
          "AI Provider returned invalid JSON string",
          { rawText },
        );
      }

      const validation = params.schema.safeParse(parsedJson);
      if (!validation.success) {
        throw new AppError(
          502,
          ErrorCode.AI_PROVIDER_ERROR,
          `AI Structured Output failed validation for schema "${params.schemaName}"`,
          validation.error.format(),
        );
      }

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens =
        completion.usage?.total_tokens ?? inputTokens + outputTokens;

      const modelInfo = this.getModelInfo();
      const estimatedCostUsd =
        (inputTokens / 1000) * modelInfo.costPer1kInputTokensUsd +
        (outputTokens / 1000) * modelInfo.costPer1kOutputTokensUsd;

      return {
        data: validation.data,
        rawText,
        model: this.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
      };
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const message =
        err instanceof Error ? err.message : "Unknown OpenAI Error";
      throw new AppError(
        502,
        ErrorCode.AI_PROVIDER_ERROR,
        `OpenAI invocation failed: ${message}`,
      );
    }
  }

  async generateText(params: TextGenerationParams): Promise<AITextResponse> {
    try {
      const messages: ChatCompletionMessageParam[] = [];

      if (params.systemPrompt) {
        messages.push({ role: "system", content: params.systemPrompt });
      }

      messages.push({ role: "user", content: params.prompt });

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? 2000,
      });

      const text = completion.choices[0].message.content ?? "";
      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens =
        completion.usage?.total_tokens ?? inputTokens + outputTokens;

      const modelInfo = this.getModelInfo();
      const estimatedCostUsd =
        (inputTokens / 1000) * modelInfo.costPer1kInputTokensUsd +
        (outputTokens / 1000) * modelInfo.costPer1kOutputTokensUsd;

      return {
        text,
        model: this.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown OpenAI Error";
      throw new AppError(
        502,
        ErrorCode.AI_PROVIDER_ERROR,
        `OpenAI text invocation failed: ${message}`,
      );
    }
  }
}
