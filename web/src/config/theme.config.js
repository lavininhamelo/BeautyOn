/**
 * Light theme: CSS custom properties + Tailwind `beauty.*` palette.
 * In the browser, variables are applied to the document root; under Node (Tailwind/PostCSS)
 * this module only exports data — `document` is not available.
 *
 * Palette (hex reference):
 * - Background / claros: #F3E9DC
 * - Primary: #5e3023
 * - Secondary: #895737
 * - Warm mid / borders, realce em inputs: #c08553
 * - Warm light / hover suave, superfícies desativadas: #dd9f6b
 */

const rootVariables = {
  /* shadcn-style tokens (HSL components only, used as hsl(var(--name))) */
  '--background': '34 37% 91%',
  '--foreground': '18 28% 19%',
  '--card': '35 30% 97%',
  '--card-foreground': '18 28% 19%',
  '--popover': '35 30% 97%',
  '--popover-foreground': '18 28% 19%',
  '--primary': '18 46% 25%',
  '--primary-foreground': '34 37% 91%',
  '--secondary': '25 43% 38%',
  '--secondary-foreground': '34 40% 96%',
  '--muted': '32 28% 87%',
  '--muted-foreground': '20 16% 34%',
  '--accent': '28 47% 54%',
  '--accent-foreground': '18 35% 14%',
  '--destructive': '0 72% 45%',
  '--destructive-foreground': '0 0% 100%',
  '--border': '30 22% 78%',
  '--input': '40 45% 97%',
  '--ring': '18 46% 25%',
  '--radius': '0.625rem',

  /* BeautyOn semantic hex (used as var(--color-…)) */
  '--color-primary': '#5e3023',
  '--color-primary-darken': '#4a2618',
  '--color-secondary': '#895737',
  '--color-warm-mid': '#c08553',
  '--color-warm-light': '#dd9f6b',
  '--color-white': '#fffcf9',
  '--color-white-darken': '#ede4d9',
  '--color-text-white': '#3d2a22',
  '--color-light-gray': '#6e584d',
  '--color-hard-gray': '#8a7268',
  '--color-shape': '#e8d4c0',
  '--color-black-medium': '#ebe3d7',
  '--color-background': '#F3E9DC',
  '--color-inputs': '#faf6f0',
  '--color-input-border': '#c9b49e',
  '--color-disabled-bg': '#f2e4d6',
  '--color-disabled-text': '#9a8578',
  '--color-header-bg': '#5e3023',
  '--color-header-text': '#F3E9DC',
  /** Opaque links on primary header (do not combine with Tailwind `/opacity` on `var(--hex)`). */
  '--color-header-link': '#fff8f4',
  '--color-header-link-muted': '#e8d4cb',
  '--color-drawer-bg': '#895737',
  '--color-error': '#b4232c',
  '--color-success': '#1f6b55',
  '--color-warning': '#a67c00',
  '--color-toast-info-background': '#eef4ff',
  '--color-toast-info-text': '#2e5aac',
  '--color-toast-success-background': '#e8fff5',
  '--color-toast-success-text': '#1f6b55',
  '--color-toast-error-background': '#fde8ec',
  '--color-toast-error-text': '#b12d45',
};

/** Maps to Tailwind `beauty.*` (kept in sync with `--color-*`). */
const beautyTailwindColors = {
  rose: rootVariables['--color-primary'],
  cream: rootVariables['--color-white'],
  background: rootVariables['--color-background'],
  surface: rootVariables['--color-black-medium'],
  shape: rootVariables['--color-shape'],
  muted: rootVariables['--color-light-gray'],
  gray: rootVariables['--color-hard-gray'],
  text: rootVariables['--color-text-white'],
  error: rootVariables['--color-error'],
  secondary: rootVariables['--color-secondary'],
  warmMid: rootVariables['--color-warm-mid'],
  warmLight: rootVariables['--color-warm-light'],
};

/** Writes all CSS variables onto `<html>` (browser only). */
function applyRootThemeVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(rootVariables)) {
    root.style.setProperty(name, value);
  }
}

applyRootThemeVariables();

module.exports = {
  rootVariables,
  beautyTailwindColors,
  applyRootThemeVariables,
};
