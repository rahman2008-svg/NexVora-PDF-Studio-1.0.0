import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { dictionaries, type Lang, type TKey } from './i18n';

export type ThemeSetting = 'dark' | 'light' | 'system';
export type PageSizeName = 'A3' | 'A4' | 'A5' | 'A6' | 'Letter' | 'Legal';
export type ExportMode = 'download' | 'open';

export type StudioSettings = {
  lang: Lang;
  theme: ThemeSetting;
  pageSize: PageSizeName;
  defaultFont: string;
  autosave: boolean;
  autosaveDelaySec: number;
  exportMode: ExportMode;
  filenamePattern: string; // supports {title} and {date}
  pdfAuthor: string;
  confirmDelete: boolean;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  lang: 'en',
  theme: 'dark',
  pageSize: 'A4',
  defaultFont: 'Roboto',
  autosave: true,
  autosaveDelaySec: 3,
  exportMode: 'download',
  filenamePattern: '{title}',
  pdfAuthor: '',
  confirmDelete: true,
};

const KEY = 'nexvora-studio-settings-v1';

export const loadSettings = (): StudioSettings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StudioSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const resolveTheme = (theme: ThemeSetting): 'dark' | 'light' =>
  theme === 'system'
    ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : theme;

type Ctx = {
  settings: StudioSettings;
  update: (patch: Partial<StudioSettings>) => void;
  reset: () => void;
  resolvedTheme: 'dark' | 'light';
  t: (key: TKey) => string;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StudioSettings>(loadSettings);
  const [resolvedTheme, setResolved] = useState<'dark' | 'light'>(() =>
    resolveTheme(loadSettings().theme),
  );

  const update = useCallback((patch: Partial<StudioSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Could not persist settings', e);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setSettings(DEFAULT_SETTINGS);
  }, []);

  useEffect(() => {
    const apply = () => {
      const r = resolveTheme(settings.theme);
      setResolved(r);
      document.documentElement.dataset.nexTheme = r;
    };
    apply();
    if (settings.theme !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  useEffect(() => {
    document.documentElement.lang = settings.lang === 'bn' ? 'bn' : 'en';
  }, [settings.lang]);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      update,
      reset,
      resolvedTheme,
      t: (key) => dictionaries[settings.lang][key] ?? dictionaries.en[key],
    }),
    [settings, update, reset, resolvedTheme],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
};
