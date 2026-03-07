import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { useAISettings } from '../context/AISettingsContext';
import { AIProvider, type AIProviderType } from '../types';

interface AISettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_ORDER: AIProviderType[] = [AIProvider.KIMI_CODE_2_5, AIProvider.GEMINI, AIProvider.OPENAI];

const EMPTY_KEYS: Record<AIProviderType, string> = {
  [AIProvider.KIMI_CODE_2_5]: '',
  [AIProvider.GEMINI]: '',
  [AIProvider.OPENAI]: '',
};

function providerStatusLabel(configured: boolean): string {
  return configured ? 'Configured' : 'Missing key';
}

export default function AISettingsModal({ open, onClose }: AISettingsModalProps) {
  const { settings, loading, saving, testing, error, lastTest, saveSettings, testConnection } = useAISettings();

  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>(AIProvider.OPENAI);
  const [keyInputs, setKeyInputs] = useState<Record<AIProviderType, string>>(EMPTY_KEYS);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (saving || testing) {
      return;
    }

    onClose();
  }, [onClose, saving, testing]);

  useEffect(() => {
    if (!open || !settings) {
      return;
    }

    const fallbackProvider = settings.activeProvider ?? AIProvider.OPENAI;
    setSelectedProvider(fallbackProvider);
    setKeyInputs(EMPTY_KEYS);
    setNotice(null);
    setLocalError(null);
  }, [open, settings]);

  const providerMap = useMemo(() => {
    const map = new Map(settings?.providers.map((item) => [item.provider, item]) ?? []);
    return map;
  }, [settings]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialog = modalRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.offsetParent !== null);

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleClose]);

  if (!open) {
    return null;
  }

  const upsertPendingKeys = async (): Promise<void> => {
    const keysPayload = Object.entries(keyInputs).reduce<Partial<Record<AIProviderType, string>>>((acc, [provider, key]) => {
      const trimmed = key.trim();
      if (trimmed.length > 0) {
        acc[provider as AIProviderType] = trimmed;
      }
      return acc;
    }, {});

    const hasKeys = Object.keys(keysPayload).length > 0;

    const result = await saveSettings({
      activeProvider: selectedProvider,
      keys: hasKeys ? keysPayload : undefined,
    });

    if (result.warnings.length > 0) {
      setNotice(result.warnings.join(' '));
    } else {
      setNotice('AI settings saved.');
    }

    setKeyInputs(EMPTY_KEYS);
  };

  const handleSave = async () => {
    try {
      setLocalError(null);
      await upsertPendingKeys();
    } catch (err) {
      if (err instanceof ApiError) {
        setLocalError(err.message);
      } else if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Failed to save AI settings.');
      }
    }
  };

  const handleTest = async () => {
    try {
      setLocalError(null);
      setNotice(null);

      const hasUnsaved = keyInputs[selectedProvider].trim().length > 0;
      if (hasUnsaved) {
        await upsertPendingKeys();
      } else {
        await saveSettings({ activeProvider: selectedProvider });
      }

      const result = await testConnection(selectedProvider);
      setNotice(`${result.message} Using ${result.model}.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setLocalError(err.message);
      } else if (err instanceof Error) {
        setLocalError(err.message);
      } else {
        setLocalError('Failed to test connection.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-3xl rounded-3xl border border-white/30 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-slate-900">
              AI Engine Settings
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-slate-600">
              Choose a provider, set API keys, and validate connectivity before running triage.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {(localError || error) && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {localError || error}
            </div>
          )}

          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          {lastTest && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Last test: {lastTest.displayName} at {new Date(lastTest.testedAt).toLocaleString()}.
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            {PROVIDER_ORDER.map((provider) => {
              const providerInfo = providerMap.get(provider);
              const isSelected = selectedProvider === provider;

              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setSelectedProvider(provider)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{providerInfo?.displayName ?? provider}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        providerInfo?.configured
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {providerStatusLabel(!!providerInfo?.configured)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{providerInfo?.maskedKey || 'No key stored yet.'}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            {PROVIDER_ORDER.map((provider) => {
              const providerInfo = providerMap.get(provider);
              const label = providerInfo?.displayName ?? provider;

              return (
                <label key={provider} className="grid gap-1 text-sm text-slate-700">
                  <span className="font-medium">
                    {label} API key
                    {selectedProvider === provider ? ' (active)' : ''}
                  </span>
                  <input
                    type="password"
                    value={keyInputs[provider]}
                    onChange={(event) =>
                      setKeyInputs((current) => ({
                        ...current,
                        [provider]: event.target.value,
                      }))
                    }
                    placeholder={providerInfo?.configured ? `Stored: ${providerInfo.maskedKey}` : 'Enter API key'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary-soft)]"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={handleTest}
            disabled={loading || saving || testing}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing ? 'Testing...' : 'Save & Test Connection'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || testing}
            className="rounded-xl bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
