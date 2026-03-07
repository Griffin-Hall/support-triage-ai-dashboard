import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import {
  AIProvider,
  AI_PROVIDER_LABELS,
  AI_PROVIDER_VALUES,
  type AIProviderType,
  getApiKeyForProvider,
  getModelForProvider,
  isAiProvider,
  isProviderConfigured,
  maskApiKey,
  validateApiKey,
} from '../ai/providers';

const prisma = new PrismaClient();
const router = Router();

const providerEnumSchema = z.enum([
  AIProvider.KIMI_CODE_2_5,
  AIProvider.GEMINI,
  AIProvider.OPENAI,
]);

const saveSettingsSchema = z.object({
  activeProvider: providerEnumSchema.nullable().optional(),
  keys: z
    .object({
      [AIProvider.KIMI_CODE_2_5]: z.string().optional(),
      [AIProvider.GEMINI]: z.string().optional(),
      [AIProvider.OPENAI]: z.string().optional(),
    })
    .partial()
    .optional(),
});

const testConnectionSchema = z.object({
  provider: providerEnumSchema.optional(),
});

function normalizeKey(value: string | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDemoOpenAiKey(): string | null {
  const candidate = process.env.OPENAI_API_KEY?.trim();
  if (!candidate) {
    return null;
  }

  return validateApiKey(AIProvider.OPENAI, candidate) ? candidate : null;
}

async function getOrCreateConfig() {
  const existing = await prisma.aiConfig.findUnique({
    where: { id: 1 },
  });

  if (existing) {
    return existing;
  }

  return prisma.aiConfig.create({
    data: {
      id: 1,
      activeProvider: null,
      openaiApiKey: null,
      geminiApiKey: null,
      kimiApiKey: null,
    },
  });
}

function providerState(config: {
  activeProvider: string | null;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  kimiApiKey: string | null;
}) {
  const demoOpenAiKey = getDemoOpenAiKey();

  return AI_PROVIDER_VALUES.map((provider) => {
    const dbKey = getApiKeyForProvider(config, provider);
    const hasDbKey = isProviderConfigured(config, provider);
    const usingServerManagedKey = provider === AIProvider.OPENAI && !hasDbKey && !!demoOpenAiKey;

    return {
      provider,
      displayName: AI_PROVIDER_LABELS[provider],
      configured: hasDbKey || usingServerManagedKey,
      maskedKey: hasDbKey ? maskApiKey(dbKey) : usingServerManagedKey ? 'server-managed' : null,
    };
  });
}

function serializeConfig(config: {
  activeProvider: string | null;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  kimiApiKey: string | null;
  updatedAt: Date;
}) {
  const activeProvider = isAiProvider(config.activeProvider) ? config.activeProvider : null;
  const providers = providerState(config);

  return {
    activeProvider,
    providers,
    hasAnyConfigured: providers.some((entry) => entry.configured),
    updatedAt: config.updatedAt.toISOString(),
  };
}

router.get('/settings', async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json(serializeConfig(config));
  } catch (error) {
    console.error('Error loading AI settings:', error);
    res.status(500).json({
      error: 'Failed to load AI settings',
      code: 'AI_SETTINGS_LOAD_FAILED',
    });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const payload = saveSettingsSchema.parse(req.body ?? {});
    const current = await getOrCreateConfig();

    const updateData: {
      activeProvider?: AIProviderType | null;
      openaiApiKey?: string | null;
      geminiApiKey?: string | null;
      kimiApiKey?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(payload, 'activeProvider')) {
      updateData.activeProvider = payload.activeProvider ?? null;
    }

    if (payload.keys) {
      const nextOpenAi = normalizeKey(payload.keys[AIProvider.OPENAI]);
      const nextGemini = normalizeKey(payload.keys[AIProvider.GEMINI]);
      const nextKimi = normalizeKey(payload.keys[AIProvider.KIMI_CODE_2_5]);

      if (nextOpenAi !== undefined) {
        updateData.openaiApiKey = nextOpenAi;
      }

      if (nextGemini !== undefined) {
        updateData.geminiApiKey = nextGemini;
      }

      if (nextKimi !== undefined) {
        updateData.kimiApiKey = nextKimi;
      }
    }

    const updated = await prisma.aiConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    const serialized = serializeConfig(updated);
    const warnings: string[] = [];

    if (serialized.activeProvider && !serialized.providers.find((entry) => entry.provider === serialized.activeProvider)?.configured) {
      warnings.push('The selected provider does not currently have an API key configured.');
    }

    res.json({
      settings: serialized,
      warnings,
    });
  } catch (error) {
    console.error('Error saving AI settings:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid AI settings payload',
        code: 'AI_SETTINGS_INVALID',
      });
    }

    res.status(500).json({
      error: 'Failed to save AI settings',
      code: 'AI_SETTINGS_SAVE_FAILED',
    });
  }
});

router.post('/settings/test', async (req, res) => {
  try {
    const { provider } = testConnectionSchema.parse(req.body ?? {});
    const config = await getOrCreateConfig();

    const selectedProvider = provider ?? (isAiProvider(config.activeProvider) ? config.activeProvider : null);

    if (!selectedProvider) {
      return res.status(400).json({
        error: 'Select an AI provider before testing the connection.',
        code: 'AI_PROVIDER_NOT_SELECTED',
      });
    }

    const dbKey = getApiKeyForProvider(config, selectedProvider);
    const apiKey = dbKey || (selectedProvider === AIProvider.OPENAI ? getDemoOpenAiKey() : null);

    if (!apiKey) {
      return res.status(400).json({
        error: `No API key configured for ${AI_PROVIDER_LABELS[selectedProvider]}.`,
        code: 'AI_KEY_MISSING',
      });
    }

    if (!validateApiKey(selectedProvider, apiKey)) {
      return res.status(400).json({
        error: `The API key for ${AI_PROVIDER_LABELS[selectedProvider]} appears invalid.`,
        code: 'AI_KEY_INVALID',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    res.json({
      success: true,
      provider: selectedProvider,
      displayName: AI_PROVIDER_LABELS[selectedProvider],
      model: getModelForProvider(selectedProvider),
      testedAt: new Date().toISOString(),
      message: 'Connection test succeeded.',
    });
  } catch (error) {
    console.error('Error testing AI settings:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid test request payload',
        code: 'AI_TEST_INVALID',
      });
    }

    res.status(500).json({
      error: 'Failed to test AI connection',
      code: 'AI_TEST_FAILED',
    });
  }
});

export default router;

