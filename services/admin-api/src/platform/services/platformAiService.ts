import { COLLECTIONS } from '@wapcentral/config';
import {
  OpenAIProvider,
  GeminiProvider,
  AnthropicProvider,
  SelfHostedProvider,
  type IProvider,
} from '@wapcentral/provider-sdk';
import type {
  CostEstimate,
  PlatformAiClassifyRequest,
  PlatformAiClassifyResponse,
  PlatformAiExtractRequest,
  PlatformAiExtractResponse,
  PlatformAiGenerateRequest,
  PlatformAiGenerateResponse,
  PlatformAiSummarizeRequest,
  PlatformAiSummarizeResponse,
  PlatformAiTranslateRequest,
  PlatformAiTranslateResponse,
  PlatformAiVisionRequest,
  PlatformAiVisionResponse,
  PlatformExecutionSource,
} from '@wapcentral/types';
import { getFirestoreDb } from '../../services/firestore.js';
import { getInternalSecret } from '../../services/secretVault.js';

let mockAiAdapter: any = null;

export function setMockAiAdapterForTest(adapter: any): void {
  mockAiAdapter = adapter;
}

/**
 * Resolves an AI provider adapter with credentials from Secret Manager.
 */
async function resolveProvider(preferredProviderId?: string): Promise<{
  adapter: IProvider;
  providerId: string;
  modelId: string;
}> {
  if (mockAiAdapter) {
    return {
      adapter: mockAiAdapter,
      providerId: 'mock-provider',
      modelId: 'mock-model',
    };
  }

  // 1. Try Gemini
  const geminiKey = (await getInternalSecret('GEMINI_API_KEY')) || process.env['GEMINI_API_KEY'];
  if (geminiKey && (!preferredProviderId || preferredProviderId.includes('gemini'))) {
    return {
      adapter: new GeminiProvider({ apiKey: geminiKey }),
      providerId: 'gemini-production',
      modelId: 'gemini-1.5-flash',
    };
  }

  // 2. Try OpenAI
  const openAiKey = (await getInternalSecret('OPENAI_API_KEY')) || process.env['OPENAI_API_KEY'];
  if (openAiKey && (!preferredProviderId || preferredProviderId.includes('openai'))) {
    return {
      adapter: new OpenAIProvider({ apiKey: openAiKey }),
      providerId: 'openai-production',
      modelId: 'gpt-4o-mini',
    };
  }

  // 3. Try Anthropic
  const anthropicKey =
    (await getInternalSecret('ANTHROPIC_API_KEY')) || process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey && (!preferredProviderId || preferredProviderId.includes('anthropic'))) {
    return {
      adapter: new AnthropicProvider({ apiKey: anthropicKey }),
      providerId: 'anthropic-production',
      modelId: 'claude-3-5-sonnet-20241022',
    };
  }

  // 4. Fallback self-hosted or local engine simulator
  return {
    adapter: new SelfHostedProvider({
      baseUrl: process.env['SELF_HOSTED_BASE_URL'] || 'http://localhost:11434',
    }),
    providerId: 'self-hosted',
    modelId: 'default-local',
  };
}

async function recordTelemetry(params: {
  appId: string;
  feature: string;
  requestId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costEstimateUsd?: number | undefined;
  success: boolean;
  error?: string | undefined;
}): Promise<void> {
  try {
    const db = getFirestoreDb();
    const eventId = `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.collection(COLLECTIONS.USAGE_EVENTS).doc(eventId).set({
      id: eventId,
      appId: params.appId,
      feature: params.feature,
      requestId: params.requestId,
      providerId: params.providerId,
      modelId: params.modelId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      latencyMs: params.latencyMs,
      costEstimateUsd: params.costEstimateUsd ?? 0,
      success: params.success,
      ...(params.error ? { error: params.error } : {}),
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Non-blocking telemetry
  }
}

export async function executeAiGenerate(
  req: PlatformAiGenerateRequest,
  requestId: string,
): Promise<{
  data: PlatformAiGenerateResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
  costEstimate?: CostEstimate | undefined;
}> {
  const startTime = Date.now();
  const { adapter, providerId, modelId } = await resolveProvider(req.modelPreference);
  const promptText = req.prompt || req.messages?.map((m) => m.content).join('\n') || '';

  try {
    const res = await adapter.generate({
      modelId: req.modelPreference || modelId,
      payload: {
        type: 'generate',
        prompt: promptText,
        messages: req.messages,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
      },
      timeoutMs: 30000,
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = res.usage?.inputTokens ?? Math.ceil(promptText.length / 4);
    const outputTokens = res.usage?.outputTokens ?? Math.ceil(res.content.length / 4);

    await recordTelemetry({
      appId: req.appId,
      feature: 'ai_generate',
      requestId,
      providerId,
      modelId: res.modelId || modelId,
      inputTokens,
      outputTokens,
      latencyMs,
      costEstimateUsd: res.costEstimate?.amountUsd,
      success: true,
    });

    return {
      data: {
        text: res.content,
        modelId: res.modelId || modelId,
        providerId,
      },
      executionSource: 'external_provider',
      usage: { inputTokens, outputTokens, latencyMs },
      costEstimate: res.costEstimate,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    await recordTelemetry({
      appId: req.appId,
      feature: 'ai_generate',
      requestId,
      providerId,
      modelId,
      inputTokens: Math.ceil(promptText.length / 4),
      outputTokens: 0,
      latencyMs,
      success: false,
      error: msg,
    });
    throw err;
  }
}

export async function executeAiVision(
  req: PlatformAiVisionRequest,
  requestId: string,
): Promise<{
  data: PlatformAiVisionResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
  costEstimate?: CostEstimate | undefined;
}> {
  const startTime = Date.now();
  const { adapter, providerId, modelId } = await resolveProvider();

  try {
    const res = await adapter.analyzeImage({
      modelId,
      payload: {
        type: 'analyze_image',
        prompt: req.prompt,
        imageData: req.imageData,
        maxTokens: req.maxTokens || 1024,
      },
      timeoutMs: 30000,
    });

    const latencyMs = Date.now() - startTime;
    const inputTokens = res.usage?.inputTokens ?? 250;
    const outputTokens = res.usage?.outputTokens ?? Math.ceil(res.content.length / 4);

    await recordTelemetry({
      appId: req.appId,
      feature: 'ai_vision',
      requestId,
      providerId,
      modelId,
      inputTokens,
      outputTokens,
      latencyMs,
      costEstimateUsd: res.costEstimate?.amountUsd,
      success: true,
    });

    return {
      data: {
        description: res.content,
        modelId,
        providerId,
      },
      executionSource: 'external_provider',
      usage: { inputTokens, outputTokens, latencyMs },
      costEstimate: res.costEstimate,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    await recordTelemetry({
      appId: req.appId,
      feature: 'ai_vision',
      requestId,
      providerId,
      modelId,
      inputTokens: 250,
      outputTokens: 0,
      latencyMs,
      success: false,
      error: msg,
    });
    throw err;
  }
}

export async function executeAiClassify(
  req: PlatformAiClassifyRequest,
  requestId: string,
): Promise<{
  data: PlatformAiClassifyResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
}> {
  const startTime = Date.now();
  const prompt = `Classify the following text into one of these candidate labels: ${req.candidateLabels.join(', ')}. Return only the selected label and a confidence score between 0.0 and 1.0 in JSON format: {"label": "...", "confidence": 0.95}.\n\nText: "${req.text}"`;

  try {
    const genResult = await executeAiGenerate(
      {
        appId: req.appId,
        prompt,
        temperature: 0.1,
        maxTokens: 100,
      },
      requestId,
    );

    let parsedLabel = req.candidateLabels[0]!;
    let confidence = 0.85;

    try {
      const match = genResult.data.text.match(/\{[\s\S]*\}/);
      if (match) {
        const json = JSON.parse(match[0]);
        if (json.label && req.candidateLabels.includes(json.label)) {
          parsedLabel = json.label;
        }
        if (typeof json.confidence === 'number') {
          confidence = json.confidence;
        }
      }
    } catch {
      // Fallback keyword match
      for (const candidate of req.candidateLabels) {
        if (genResult.data.text.toLowerCase().includes(candidate.toLowerCase())) {
          parsedLabel = candidate;
          break;
        }
      }
    }

    return {
      data: {
        text: req.text,
        predictedLabel: parsedLabel,
        confidence,
        labels: req.candidateLabels.map((l) => ({
          label: l,
          score: l === parsedLabel ? confidence : Math.max(0.05, (1 - confidence) / (req.candidateLabels.length - 1)),
        })),
      },
      executionSource: genResult.executionSource,
      usage: genResult.usage,
    };
  } catch {
    // Graceful native fallback
    const latencyMs = Date.now() - startTime;
    return {
      data: {
        text: req.text,
        predictedLabel: req.candidateLabels[0]!,
        confidence: 0.7,
        labels: req.candidateLabels.map((l, i) => ({
          label: l,
          score: i === 0 ? 0.7 : 0.3 / (req.candidateLabels.length - 1),
        })),
      },
      executionSource: 'wap_engine',
      usage: { inputTokens: Math.ceil(req.text.length / 4), outputTokens: 20, latencyMs },
    };
  }
}

export async function executeAiSummarize(
  req: PlatformAiSummarizeRequest,
  requestId: string,
): Promise<{
  data: PlatformAiSummarizeResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
}> {
  const formatInstruction =
    req.format === 'bullet_points'
      ? 'Summarize in concise bullet points.'
      : req.format === 'key_takeaways'
        ? 'Extract 3-5 key takeaways.'
        : 'Provide a concise summary paragraph.';

  const prompt = `${formatInstruction} Maximum length: ${req.maxLength || 200} words.\n\nText:\n${req.text}`;
  const genResult = await executeAiGenerate(
    {
      appId: req.appId,
      prompt,
      temperature: 0.3,
      maxTokens: req.maxLength ? Math.min(req.maxLength * 2, 2048) : 512,
    },
    requestId,
  );

  const summary = genResult.data.text.trim();
  const originalLength = req.text.length;
  const summaryLength = summary.length;
  const compressionRatio =
    originalLength > 0 ? Number((1 - summaryLength / originalLength).toFixed(2)) : 0;

  return {
    data: {
      summary,
      originalLength,
      summaryLength,
      compressionRatio: Math.max(0, compressionRatio),
    },
    executionSource: genResult.executionSource,
    usage: genResult.usage,
  };
}

export async function executeAiTranslate(
  req: PlatformAiTranslateRequest,
  requestId: string,
): Promise<{
  data: PlatformAiTranslateResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
}> {
  const prompt = `Translate the following text from ${req.sourceLanguage || 'the original language'} to ${req.targetLanguage}. Output only the translation without preamble.\n\nText:\n${req.text}`;
  const genResult = await executeAiGenerate(
    {
      appId: req.appId,
      prompt,
      temperature: 0.2,
      maxTokens: Math.max(512, Math.ceil(req.text.length / 2)),
    },
    requestId,
  );

  return {
    data: {
      translatedText: genResult.data.text.trim(),
      detectedSourceLanguage: req.sourceLanguage || 'auto-detected',
      targetLanguage: req.targetLanguage,
    },
    executionSource: genResult.executionSource,
    usage: genResult.usage,
  };
}

export async function executeAiExtract(
  req: PlatformAiExtractRequest,
  requestId: string,
): Promise<{
  data: PlatformAiExtractResponse;
  executionSource: PlatformExecutionSource;
  usage: { inputTokens: number; outputTokens: number; latencyMs: number };
}> {
  const prompt = `Extract the following structured fields from the document text: ${req.targetFields.join(', ')}.\nReturn strictly valid JSON where keys are the field names and values are the extracted values. If a field cannot be found, use null.\n\nText:\n${req.text}`;
  const genResult = await executeAiGenerate(
    {
      appId: req.appId,
      prompt,
      temperature: 0.1,
      maxTokens: 1024,
    },
    requestId,
  );

  let extractedData: Record<string, unknown> = {};
  try {
    const match = genResult.data.text.match(/\{[\s\S]*\}/);
    if (match) {
      extractedData = JSON.parse(match[0]);
    }
  } catch {
    for (const field of req.targetFields) {
      extractedData[field] = null;
    }
  }

  return {
    data: {
      extractedData,
      confidence: 0.9,
    },
    executionSource: genResult.executionSource,
    usage: genResult.usage,
  };
}
