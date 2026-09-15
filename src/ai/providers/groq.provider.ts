import OpenAI from "openai";
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
import { logger } from "../../utils/logger.js";


export class GroqProvider implements AIProvider {
  readonly name = "groq";
  private client: OpenAI;
  private model: string;
  private maxRetries = 2;

  constructor(
    apiKey: string = process.env.GROQ_API_KEY || "",
    model: string = process.env.GROQ_MODEL || "",
  ) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.GROQ_API_KEY || "",
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.model = model;
  }

  normalizeError(err: any): AppError {
    if (err instanceof AppError) return err;

    const statusCode = err?.status || err?.statusCode;
    if (statusCode === 429) {
      return new AppError(
        429,
        ErrorCode.AI_PROVIDER_ERROR,
        "AI is temporarily busy (rate limit reached). Please try again in a few moments.",
      );
    }
    if (err?.code === "ETIMEDOUT" || err?.message?.includes("timeout")) {
      return new AppError(
        504,
        ErrorCode.AI_PROVIDER_ERROR,
        "AI request timed out. Please try again.",
      );
    }
    if (statusCode >= 500 && statusCode < 600) {
      return new AppError(
        502,
        ErrorCode.AI_PROVIDER_ERROR,
        "AI is temporarily unavailable. Please try again shortly.",
      );
    }
    return new AppError(
      500,
      ErrorCode.AI_PROVIDER_ERROR,
      err?.message || "Failed to communicate with Groq AI provider.",
    );
  }

  getModelInfo(): AIModelInfo {
    return {
      provider: "groq",
      modelName: this.model,
      maxContextTokens: 131072,
      costPer1kInputTokensUsd: 0.0005,
      costPer1kOutputTokensUsd: 0.0008,
    };
  }

  /**
   * Helper to execute an async operation with bounded retry on 429 / transient 5xx errors.
   */
  private async executeWithRetry<R>(operation: () => Promise<R>): Promise<R> {
    let lastError: any = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err: any) {
        if (err instanceof AppError) {
          throw err;
        }
        lastError = err;
        const statusCode = err?.status || err?.statusCode;
        const isRateLimit = statusCode === 429;
        const isTransient5xx = statusCode >= 500 && statusCode < 600;

        if ((isRateLimit || isTransient5xx) && attempt < this.maxRetries) {
          const backoffMs = (attempt + 1) * 750;
          logger.warn(
            `Groq API returned ${statusCode}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${this.maxRetries})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        break;
      }
    }

    if (lastError instanceof AppError) throw lastError;
    throw this.normalizeError(lastError);
  }

  async generateStructuredOutput<T>(
    params: StructuredOutputParams<T>,
  ): Promise<AIStructuredResponse<T>> {
    return this.executeWithRetry(async () => {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (params.systemPrompt) {
        messages.push({ role: "system", content: params.systemPrompt });
      }

      messages.push({
        role: "user",
        content: `${params.prompt}\n\nStrict requirement: Output must strictly conform to the expected JSON schema: ${params.schemaName}. Output only valid JSON with no markdown fences, no surrounding commentary, and no explanations outside JSON.`,
      });

      const startTime = Date.now();
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.2,
        max_tokens: params.maxTokens ?? 4000,
        response_format: { type: "json_object" },
      });

      const durationMs = Date.now() - startTime;
      const choice = completion.choices[0];
      const rawText = choice?.message?.content ?? "{}";

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (jsonErr) {
        logger.error(
          `Groq returned invalid JSON for schema ${params.schemaName}`,
          {
            durationMs,
            model: this.model,
          },
        );
        throw new AppError(
          502,
          ErrorCode.AI_PROVIDER_ERROR,
          "AI returned an invalid JSON response structure.",
        );
      }

      const validation = params.schema.safeParse(parsedJson);
      if (!validation.success) {
        logger.error(
          `Groq structured output failed schema validation for ${params.schemaName}`,
          {
            durationMs,
            errors: validation.error.format(),
          },
        );
        throw new AppError(
          502,
          ErrorCode.AI_PROVIDER_ERROR,
          `AI output did not match expected structure for "${params.schemaName}".`,
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

      logger.info(
        `Groq structured generation succeeded for ${params.schemaName}`,
        {
          model: this.model,
          totalTokens,
          durationMs,
        },
      );

      return {
        data: validation.data,
        rawText,
        model: this.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
      };
    });
  }

  async generateText(params: TextGenerationParams): Promise<AITextResponse> {
    return this.executeWithRetry(async () => {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (params.systemPrompt) {
        messages.push({ role: "system", content: params.systemPrompt });
      }

      messages.push({ role: "user", content: params.prompt });

      const startTime = Date.now();
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: params.temperature ?? 0.3,
        max_tokens: params.maxTokens ?? 2000,
      });

      const durationMs = Date.now() - startTime;
      const choice = completion.choices[0];
      const text = choice?.message?.content ?? "";

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;
      const totalTokens =
        completion.usage?.total_tokens ?? inputTokens + outputTokens;

      const modelInfo = this.getModelInfo();
      const estimatedCostUsd =
        (inputTokens / 1000) * modelInfo.costPer1kInputTokensUsd +
        (outputTokens / 1000) * modelInfo.costPer1kOutputTokensUsd;

      logger.info("Groq text generation succeeded", {
        model: this.model,
        totalTokens,
        durationMs,
      });

      return {
        text,
        model: this.model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
      };
    });
  }
}
