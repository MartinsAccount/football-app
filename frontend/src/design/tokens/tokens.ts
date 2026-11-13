// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json + tokens.light.json, generátor: build-tokens.mjs

// A téma-nevek és a tárolási kulcs egyetlen forrása a core (theme/theme.ts); itt csak re-export.
export type { ThemeName, ThemePreference } from '@football/core';
export { THEME_STORAGE_KEY } from '@football/core';

/** Feloldott nyers értékek témánként (chart-könyvtárakhoz, canvas/SVG rajzhoz). */
export const themes = {
  dark: {
    "color": {
      "bg": {
        "canvas": "#0B1220",
        "surface": "#121B2E",
        "raised": "#17223A",
        "inset": "#0E1728",
        "track": "#1E2A44",
        "selected": "#13283A",
        "best-row": "#17223A"
      },
      "border": {
        "default": "#23304D",
        "strong": "#2E3D5E"
      },
      "text": {
        "primary": "#E8EDF7",
        "secondary": "#C7D0E2",
        "muted": "#93A0B8",
        "inverse": "#0B1220"
      },
      "on": {
        "bg": "#E8EDF7",
        "fg": "#0B1220"
      },
      "accent": {
        "default": "#35E0C2",
        "text": "#35E0C2",
        "on": "#0B1220",
        "alt-blue": "#8FB3FF",
        "alt-violet": "#C4A1FF"
      },
      "signal": {
        "positive": "#35E0C2",
        "negative": "#FF8A65",
        "negative-text": "#FF8A65",
        "negative-on": "#0B1220",
        "warning": "#FFC56B",
        "warning-text": "#FFC56B",
        "neutral": "#8D99B3"
      },
      "status": {
        "ok-bg": "#0F2A2A",
        "ok-fg": "#35E0C2",
        "fail-bg": "#341C1F",
        "fail-fg": "#FF9A7A"
      },
      "tint": {
        "warning-bg": "#241C10",
        "warning-border": "#4A3A1C",
        "negative-bg": "#24151A",
        "negative-border": "#5A2E35",
        "negative-soft": "#5A2E35",
        "positive-bg": "#0F2A2A",
        "positive-border": "#1F4A4A"
      },
      "data": {
        "model": "#35E0C2",
        "market": "#6E7C99",
        "marker": "#E8EDF7",
        "track": "#1E2A44",
        "diagonal": "#93A0B8",
        "low-n": "#93A0B8"
      },
      "result": {
        "win": "#35E0C2",
        "draw": "#8D99B3",
        "loss": "#FF8A65",
        "on": "#0B1220"
      },
      "zone": {
        "champions": "#2C4A7A",
        "europe": "#4A4470",
        "mid": "#1E2A44",
        "relegation": "#6A3442",
        "home": "#E8EDF7",
        "away": "#35E0C2"
      },
      "risk": {
        "low": "#35E0C2",
        "medium": "#FFC56B",
        "high": "#FF8A65"
      },
      "overlay": "rgba(3, 8, 14, 0.6)"
    },
    "shadow": {
      "card": "none"
    },
    "font": {
      "family": {
        "display": "Sora, system-ui, sans-serif",
        "body": "Manrope, system-ui, sans-serif"
      },
      "weight": {
        "regular": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700,
        "heavy": 800
      },
      "size": {
        "micro": "11px",
        "caption": "12px",
        "small": "13px",
        "body": "15px",
        "lead": "17px",
        "h3": "20px",
        "match": "22px",
        "page": "32px",
        "h1": "38px",
        "h1-mobile": "28px",
        "num-s": "16px",
        "num-m": "22px",
        "num-l": "32px",
        "num-xl": "36px"
      },
      "line-height": {
        "tight": 1.12,
        "snug": 1.3,
        "body": 1.55
      },
      "tracking": {
        "display": "-0.03em",
        "title": "-0.02em",
        "label": "0.08em"
      }
    },
    "space": {
      "0": "0px",
      "1": "2px",
      "2": "4px",
      "3": "6px",
      "4": "8px",
      "5": "10px",
      "6": "12px",
      "7": "14px",
      "8": "16px",
      "9": "18px",
      "10": "20px",
      "11": "22px",
      "12": "24px",
      "13": "26px",
      "14": "28px",
      "16": "32px",
      "28": "56px"
    },
    "radius": {
      "xs": "2px",
      "s": "6px",
      "m": "10px",
      "l": "12px",
      "xl": "14px",
      "2xl": "18px",
      "3xl": "20px",
      "4xl": "24px",
      "pill": "999px"
    },
    "size": {
      "touch": "44px",
      "control": "48px",
      "cta": "52px",
      "chip": "22px",
      "pill": "32px",
      "bar": "6px",
      "bar-lg": "8px",
      "strip": "14px",
      "chart": "380px",
      "container": "1280px",
      "gutter": "28px",
      "gutter-mobile": "18px",
      "main-basis": "600px",
      "aside-basis": "360px"
    },
    "motion": {
      "fast": "120ms",
      "base": "180ms",
      "slow": "260ms",
      "easing": [
        0.2,
        0.8,
        0.2,
        1
      ]
    },
    "focus": {
      "ring": "2px"
    }
  },
  light: {
    "color": {
      "bg": {
        "canvas": "#F5F7FA",
        "surface": "#FFFFFF",
        "raised": "#F2F5F9",
        "inset": "#F5F7FA",
        "track": "#E3E8EF",
        "selected": "#EEF9F6",
        "best-row": "#F5F7FA"
      },
      "border": {
        "default": "#E1E6ED",
        "strong": "#CBD3DE"
      },
      "text": {
        "primary": "#0F1A2B",
        "secondary": "#334155",
        "muted": "#5B6779",
        "inverse": "#FFFFFF"
      },
      "on": {
        "bg": "#0F1A2B",
        "fg": "#FFFFFF"
      },
      "accent": {
        "default": "#14B8A0",
        "text": "#0A7F6E",
        "on": "#0F1A2B",
        "alt-blue": "#8FB3FF",
        "alt-violet": "#C4A1FF"
      },
      "signal": {
        "positive": "#14B8A0",
        "negative": "#E4572E",
        "negative-text": "#C2410C",
        "negative-on": "#FFFFFF",
        "warning": "#F2B544",
        "warning-text": "#9A4A07",
        "neutral": "#B6C0CE"
      },
      "status": {
        "ok-bg": "#E3F6F2",
        "ok-fg": "#0A6E5F",
        "fail-bg": "#FDE7E0",
        "fail-fg": "#B23A12"
      },
      "tint": {
        "warning-bg": "#FFF6E5",
        "warning-border": "#F3D9A4",
        "negative-bg": "#FDF1EC",
        "negative-border": "#F5CDBE",
        "negative-soft": "#F7C9B9",
        "positive-bg": "#E3F6F2",
        "positive-border": "#BFE6DF"
      },
      "data": {
        "model": "#14B8A0",
        "market": "#A3AEBF",
        "marker": "#0F1A2B",
        "track": "#E3E8EF",
        "diagonal": "#5B6779",
        "low-n": "#5B6779"
      },
      "result": {
        "win": "#14B8A0",
        "draw": "#B6C0CE",
        "loss": "#F08A6B",
        "on": "#0F1A2B"
      },
      "zone": {
        "champions": "#BFD3F2",
        "europe": "#D9D2F0",
        "mid": "#E8ECF2",
        "relegation": "#F2C6C6",
        "home": "#0F1A2B",
        "away": "#14B8A0"
      },
      "risk": {
        "low": "#14B8A0",
        "medium": "#F2B544",
        "high": "#E4572E"
      },
      "overlay": "rgba(15, 26, 43, 0.35)"
    },
    "shadow": {
      "card": "0 1px 2px rgba(15, 26, 43, 0.05)"
    },
    "font": {
      "family": {
        "display": "Sora, system-ui, sans-serif",
        "body": "Manrope, system-ui, sans-serif"
      },
      "weight": {
        "regular": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700,
        "heavy": 800
      },
      "size": {
        "micro": "11px",
        "caption": "12px",
        "small": "13px",
        "body": "15px",
        "lead": "17px",
        "h3": "20px",
        "match": "22px",
        "page": "32px",
        "h1": "38px",
        "h1-mobile": "28px",
        "num-s": "16px",
        "num-m": "22px",
        "num-l": "32px",
        "num-xl": "36px"
      },
      "line-height": {
        "tight": 1.12,
        "snug": 1.3,
        "body": 1.55
      },
      "tracking": {
        "display": "-0.03em",
        "title": "-0.02em",
        "label": "0.08em"
      }
    },
    "space": {
      "0": "0px",
      "1": "2px",
      "2": "4px",
      "3": "6px",
      "4": "8px",
      "5": "10px",
      "6": "12px",
      "7": "14px",
      "8": "16px",
      "9": "18px",
      "10": "20px",
      "11": "22px",
      "12": "24px",
      "13": "26px",
      "14": "28px",
      "16": "32px",
      "28": "56px"
    },
    "radius": {
      "xs": "2px",
      "s": "6px",
      "m": "10px",
      "l": "12px",
      "xl": "14px",
      "2xl": "18px",
      "3xl": "20px",
      "4xl": "24px",
      "pill": "999px"
    },
    "size": {
      "touch": "44px",
      "control": "48px",
      "cta": "52px",
      "chip": "22px",
      "pill": "32px",
      "bar": "6px",
      "bar-lg": "8px",
      "strip": "14px",
      "chart": "380px",
      "container": "1280px",
      "gutter": "28px",
      "gutter-mobile": "18px",
      "main-basis": "600px",
      "aside-basis": "360px"
    },
    "motion": {
      "fast": "120ms",
      "base": "180ms",
      "slow": "260ms",
      "easing": [
        0.2,
        0.8,
        0.2,
        1
      ]
    },
    "focus": {
      "ring": "2px"
    }
  }
} as const;

/** @deprecated – használd: themes.dark */
export const tokens = themes.dark;

/** CSS-változó hivatkozások – komponensben ezt használd, így a téma-váltás magától működik. */
export const cssVar = {
  "color.bg.canvas": "var(--color-bg-canvas)",
  "color.bg.surface": "var(--color-bg-surface)",
  "color.bg.raised": "var(--color-bg-raised)",
  "color.bg.inset": "var(--color-bg-inset)",
  "color.bg.track": "var(--color-bg-track)",
  "color.bg.selected": "var(--color-bg-selected)",
  "color.bg.best-row": "var(--color-bg-best-row)",
  "color.border.default": "var(--color-border-default)",
  "color.border.strong": "var(--color-border-strong)",
  "color.text.primary": "var(--color-text-primary)",
  "color.text.secondary": "var(--color-text-secondary)",
  "color.text.muted": "var(--color-text-muted)",
  "color.text.inverse": "var(--color-text-inverse)",
  "color.on.bg": "var(--color-on-bg)",
  "color.on.fg": "var(--color-on-fg)",
  "color.accent.default": "var(--color-accent-default)",
  "color.accent.text": "var(--color-accent-text)",
  "color.accent.on": "var(--color-accent-on)",
  "color.accent.alt-blue": "var(--color-accent-alt-blue)",
  "color.accent.alt-violet": "var(--color-accent-alt-violet)",
  "color.signal.positive": "var(--color-signal-positive)",
  "color.signal.negative": "var(--color-signal-negative)",
  "color.signal.negative-text": "var(--color-signal-negative-text)",
  "color.signal.negative-on": "var(--color-signal-negative-on)",
  "color.signal.warning": "var(--color-signal-warning)",
  "color.signal.warning-text": "var(--color-signal-warning-text)",
  "color.signal.neutral": "var(--color-signal-neutral)",
  "color.status.ok-bg": "var(--color-status-ok-bg)",
  "color.status.ok-fg": "var(--color-status-ok-fg)",
  "color.status.fail-bg": "var(--color-status-fail-bg)",
  "color.status.fail-fg": "var(--color-status-fail-fg)",
  "color.tint.warning-bg": "var(--color-tint-warning-bg)",
  "color.tint.warning-border": "var(--color-tint-warning-border)",
  "color.tint.negative-bg": "var(--color-tint-negative-bg)",
  "color.tint.negative-border": "var(--color-tint-negative-border)",
  "color.tint.negative-soft": "var(--color-tint-negative-soft)",
  "color.tint.positive-bg": "var(--color-tint-positive-bg)",
  "color.tint.positive-border": "var(--color-tint-positive-border)",
  "color.data.model": "var(--color-data-model)",
  "color.data.market": "var(--color-data-market)",
  "color.data.marker": "var(--color-data-marker)",
  "color.data.track": "var(--color-data-track)",
  "color.data.diagonal": "var(--color-data-diagonal)",
  "color.data.low-n": "var(--color-data-low-n)",
  "color.result.win": "var(--color-result-win)",
  "color.result.draw": "var(--color-result-draw)",
  "color.result.loss": "var(--color-result-loss)",
  "color.result.on": "var(--color-result-on)",
  "color.zone.champions": "var(--color-zone-champions)",
  "color.zone.europe": "var(--color-zone-europe)",
  "color.zone.mid": "var(--color-zone-mid)",
  "color.zone.relegation": "var(--color-zone-relegation)",
  "color.zone.home": "var(--color-zone-home)",
  "color.zone.away": "var(--color-zone-away)",
  "color.risk.low": "var(--color-risk-low)",
  "color.risk.medium": "var(--color-risk-medium)",
  "color.risk.high": "var(--color-risk-high)",
  "color.overlay": "var(--color-overlay)",
  "shadow.card": "var(--shadow-card)",
  "font.family.display": "var(--font-family-display)",
  "font.family.body": "var(--font-family-body)",
  "font.weight.regular": "var(--font-weight-regular)",
  "font.weight.medium": "var(--font-weight-medium)",
  "font.weight.semibold": "var(--font-weight-semibold)",
  "font.weight.bold": "var(--font-weight-bold)",
  "font.weight.heavy": "var(--font-weight-heavy)",
  "font.size.micro": "var(--font-size-micro)",
  "font.size.caption": "var(--font-size-caption)",
  "font.size.small": "var(--font-size-small)",
  "font.size.body": "var(--font-size-body)",
  "font.size.lead": "var(--font-size-lead)",
  "font.size.h3": "var(--font-size-h3)",
  "font.size.match": "var(--font-size-match)",
  "font.size.page": "var(--font-size-page)",
  "font.size.h1": "var(--font-size-h1)",
  "font.size.h1-mobile": "var(--font-size-h1-mobile)",
  "font.size.num-s": "var(--font-size-num-s)",
  "font.size.num-m": "var(--font-size-num-m)",
  "font.size.num-l": "var(--font-size-num-l)",
  "font.size.num-xl": "var(--font-size-num-xl)",
  "font.line-height.tight": "var(--font-line-height-tight)",
  "font.line-height.snug": "var(--font-line-height-snug)",
  "font.line-height.body": "var(--font-line-height-body)",
  "font.tracking.display": "var(--font-tracking-display)",
  "font.tracking.title": "var(--font-tracking-title)",
  "font.tracking.label": "var(--font-tracking-label)",
  "space.0": "var(--space-0)",
  "space.1": "var(--space-1)",
  "space.2": "var(--space-2)",
  "space.3": "var(--space-3)",
  "space.4": "var(--space-4)",
  "space.5": "var(--space-5)",
  "space.6": "var(--space-6)",
  "space.7": "var(--space-7)",
  "space.8": "var(--space-8)",
  "space.9": "var(--space-9)",
  "space.10": "var(--space-10)",
  "space.11": "var(--space-11)",
  "space.12": "var(--space-12)",
  "space.13": "var(--space-13)",
  "space.14": "var(--space-14)",
  "space.16": "var(--space-16)",
  "space.28": "var(--space-28)",
  "radius.xs": "var(--radius-xs)",
  "radius.s": "var(--radius-s)",
  "radius.m": "var(--radius-m)",
  "radius.l": "var(--radius-l)",
  "radius.xl": "var(--radius-xl)",
  "radius.2xl": "var(--radius-2xl)",
  "radius.3xl": "var(--radius-3xl)",
  "radius.4xl": "var(--radius-4xl)",
  "radius.pill": "var(--radius-pill)",
  "size.touch": "var(--size-touch)",
  "size.control": "var(--size-control)",
  "size.cta": "var(--size-cta)",
  "size.chip": "var(--size-chip)",
  "size.pill": "var(--size-pill)",
  "size.bar": "var(--size-bar)",
  "size.bar-lg": "var(--size-bar-lg)",
  "size.strip": "var(--size-strip)",
  "size.chart": "var(--size-chart)",
  "size.container": "var(--size-container)",
  "size.gutter": "var(--size-gutter)",
  "size.gutter-mobile": "var(--size-gutter-mobile)",
  "size.main-basis": "var(--size-main-basis)",
  "size.aside-basis": "var(--size-aside-basis)",
  "motion.fast": "var(--motion-fast)",
  "motion.base": "var(--motion-base)",
  "motion.slow": "var(--motion-slow)",
  "motion.easing": "var(--motion-easing)",
  "focus.ring": "var(--focus-ring)"
} as const;

export type TokenPath = keyof typeof cssVar;
export const v = (path: TokenPath): string => cssVar[path];
