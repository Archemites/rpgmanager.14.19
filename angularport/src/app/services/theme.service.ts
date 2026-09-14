import { Injectable, signal } from '@angular/core';

export const THEME_KEY = 'rpg-table-theme';
export const THEMES = ['cyberpunk', 'dnd', 'cthulhu', 'black', 'cream'] as const;
export type ThemeName = typeof THEMES[number];
export const DEFAULT_THEME: ThemeName = 'cyberpunk';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly currentTheme = signal<ThemeName>(DEFAULT_THEME);

  constructor() {
    let saved: ThemeName = DEFAULT_THEME;
    try {
      const stored = localStorage.getItem(THEME_KEY) as ThemeName;
      if (THEMES.includes(stored)) saved = stored;
    } catch (_) {}
    this.applyTheme(saved);
  }

  applyTheme(theme: ThemeName): void {
    if (!THEMES.includes(theme)) theme = DEFAULT_THEME;
    this.currentTheme.set(theme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }

  getThemeMapBg(): string {
    if (typeof document === 'undefined') return '#03140a';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--map-bg').trim();
    return v || '#03140a';
  }

  getThemeGridColor(): string {
    if (typeof document === 'undefined') return '#45ff78';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return v || '#45ff78';
  }

  getThemeFont(): string {
    if (typeof document === 'undefined') return '"VT323", monospace';
    const v = getComputedStyle(document.documentElement).getPropertyValue('--font-head').trim() ||
              getComputedStyle(document.documentElement).getPropertyValue('--font-body').trim();
    return v || '"VT323", monospace';
  }
}
