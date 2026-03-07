import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { aiApi, ApiError } from '../api/client';
import type { AIConnectionTestResponse, AIProviderType, AISettings } from '../types';

interface AISettingsContextValue {
  settings: AISettings | null;
  loading: boolean;
  saving: boolean;
  testing: boolean;
  error: string | null;
  lastTest: AIConnectionTestResponse | null;
  refreshSettings: () => Promise<void>;
  saveSettings: (payload: {
    activeProvider?: AIProviderType | null;
    keys?: Partial<Record<AIProviderType, string>>;
  }) => Promise<{ warnings: string[] }>;
  testConnection: (provider?: AIProviderType) => Promise<AIConnectionTestResponse>;
}

const AISettingsContext = createContext<AISettingsContextValue | undefined>(undefined);

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function AISettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTest, setLastTest] = useState<AIConnectionTestResponse | null>(null);

  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      const next = await aiApi.getSettings();
      setSettings(next);
      setError(null);
    } catch (err) {
      setError(toErrorMessage(err, 'Failed to load AI settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  const saveSettings = useCallback<AISettingsContextValue['saveSettings']>(
    async (payload) => {
      try {
        setSaving(true);
        const result = await aiApi.saveSettings(payload);
        setSettings(result.settings);
        setError(null);
        return { warnings: result.warnings };
      } catch (err) {
        const message = toErrorMessage(err, 'Failed to save AI settings.');
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const testConnection = useCallback<AISettingsContextValue['testConnection']>(
    async (provider) => {
      try {
        setTesting(true);
        const result = await aiApi.testConnection(provider);
        setLastTest(result);
        setError(null);
        return result;
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(toErrorMessage(err, 'Connection test failed.'));
        }

        throw err;
      } finally {
        setTesting(false);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      saving,
      testing,
      error,
      lastTest,
      refreshSettings,
      saveSettings,
      testConnection,
    }),
    [settings, loading, saving, testing, error, lastTest, refreshSettings, saveSettings, testConnection],
  );

  return <AISettingsContext.Provider value={value}>{children}</AISettingsContext.Provider>;
}

export function useAISettings() {
  const context = useContext(AISettingsContext);

  if (!context) {
    throw new Error('useAISettings must be used within AISettingsProvider');
  }

  return context;
}
