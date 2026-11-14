export type Lang = 'mn' | 'en';

const LANG_STORAGE_KEY = 'site_lang_v1';

export function loadLang(): Lang {
  if (typeof window === 'undefined') return 'mn';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    return saved === 'en' ? 'en' : 'mn';
  } catch {
    return 'mn';
  }
}

export function saveLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Ignore storage errors
  }
}

const EN_CATEGORY_MAP: Record<string, { name: string; short: string }> = {
  football: { name: 'Footballers', short: 'Football' },
  basketball: { name: 'Basketball Stars', short: 'Basketball' },
  f1: { name: 'F1 Drivers', short: 'Formula 1' },
  motogp: { name: 'MotoGP Riders', short: 'MotoGP' },
  naruto: { name: 'Naruto & Ninja', short: 'Naruto' },
  onepiece: { name: 'One Piece Pirates', short: 'One Piece' },
  modern: { name: 'Demon Slayer & Jujutsu', short: 'Modern Hits' },
  classics: { name: 'Classic Legends', short: 'Classics' },
};

export function getCategoryDisplay(
  categoryId: string,
  defaultName: string,
  defaultShort: string,
  lang: Lang
): { name: string; short: string } {
  if (lang === 'en' && EN_CATEGORY_MAP[categoryId]) {
    return EN_CATEGORY_MAP[categoryId];
  }
  return { name: defaultName, short: defaultShort };
}
