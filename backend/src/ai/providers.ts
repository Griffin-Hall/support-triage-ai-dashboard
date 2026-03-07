export const AIProvider = {
  KIMI_CODE_2_5: 'KIMI_CODE_2_5',
  GEMINI: 'GEMINI',
  OPENAI: 'OPENAI',
} as const;

export type AIProviderType = typeof AIProvider[keyof typeof AIProvider];

export const AI_PROVIDER_VALUES: AIProviderType[] = [
  AIProvider.KIMI_CODE_2_5,
  AIProvider.GEMINI,
  AIProvider.OPENAI,
];

export const AI_PROVIDER_LABELS: Record<AIProviderType, string> = {
  [AIProvider.KIMI_CODE_2_5]: 'Kimi Code 2.5',
  [AIProvider.GEMINI]: 'Gemini',
  [AIProvider.OPENAI]: 'OpenAI',
};

export const AI_PROVIDER_MODELS: Record<AIProviderType, string> = {
  [AIProvider.KIMI_CODE_2_5]: 'Kimi Code 2.5',
  [AIProvider.GEMINI]: 'Gemini 2.0 Flash',
  [AIProvider.OPENAI]: 'gpt-4o-mini',
};

export interface AiConfigLike {
  activeProvider: string | null;
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  kimiApiKey: string | null;
}

export function isAiProvider(value: string | null | undefined): value is AIProviderType {
  return !!value && AI_PROVIDER_VALUES.includes(value as AIProviderType);
}

export function getModelForProvider(provider: AIProviderType): string {
  return AI_PROVIDER_MODELS[provider];
}

export function getApiKeyForProvider(config: AiConfigLike, provider: AIProviderType): string | null {
  switch (provider) {
    case AIProvider.OPENAI:
      return config.openaiApiKey;
    case AIProvider.GEMINI:
      return config.geminiApiKey;
    case AIProvider.KIMI_CODE_2_5:
      return config.kimiApiKey;
  }
}

export function isProviderConfigured(config: AiConfigLike, provider: AIProviderType): boolean {
  const key = getApiKeyForProvider(config, provider);
  return !!(key && key.trim().length > 0);
}

export function maskApiKey(key: string | null): string | null {
  if (!key) {
    return null;
  }

  const trimmed = key.trim();
  if (trimmed.length <= 6) {
    return '***';
  }

  return `${trimmed.slice(0, 3)}...${trimmed.slice(-4)}`;
}

export function validateApiKey(provider: AIProviderType, key: string): boolean {
  const trimmed = key.trim();

  if (provider === AIProvider.OPENAI) {
    return /^sk-[A-Za-z0-9_-]{16,}$/.test(trimmed);
  }

  if (provider === AIProvider.GEMINI) {
    return /^AIza[A-Za-z0-9_-]{16,}$/.test(trimmed);
  }

  // Kimi key formats can vary; enforce minimum entropy and length.
  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed);
}
