// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json, generátor: build-tokens.mjs

/** Feloldott nyers értékek (pl. canvas/SVG rajzhoz, chart-könyvtárakhoz). */
export const tokens = {
  "color": {
    "bg": {
      "canvas": "#0B1220",
      "surface": "#121B2E",
      "raised": "#17223A",
      "inset": "#0E1728",
      "track": "#1E2A44",
      "selected": "#13283A",
      "info": "#10202A"
    },
    "border": {
      "default": "#23304D",
      "strong": "#2E3D5E",
      "info": "#1F4A4A"
    },
    "text": {
      "primary": "#E8EDF7",
      "secondary": "#C7D0E2",
      "muted": "#93A0B8",
      "inverse": "#0B1220"
    },
    "accent": {
      "default": "#35E0C2",
      "alt-blue": "#8FB3FF",
      "alt-amber": "#FFC56B",
      "alt-violet": "#C4A1FF"
    },
    "signal": {
      "positive": "#35E0C2",
      "negative": "#FF8A65",
      "warning": "#FFC56B",
      "neutral": "#8D99B3"
    },
    "data": {
      "model": "#35E0C2",
      "market": "#6E7C99",
      "track": "#1E2A44"
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
    "warning-surface": {
      "bg": "#2A1F14",
      "border": "#5A4220"
    },
    "overlay": "rgba(3, 8, 14, 0.6)"
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
      "h2": "22px",
      "h1-mobile": "28px",
      "h1": "42px",
      "display": "48px",
      "num-s": "20px",
      "num-m": "24px",
      "num-l": "28px"
    },
    "line-height": {
      "tight": 1.1,
      "snug": 1.3,
      "body": 1.5
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
    "14": "28px",
    "16": "32px",
    "18": "36px",
    "28": "56px"
  },
  "radius": {
    "xs": "2px",
    "s": "6px",
    "m": "10px",
    "l": "12px",
    "xl": "16px",
    "2xl": "18px",
    "3xl": "24px",
    "sheet": "28px",
    "pill": "999px"
  },
  "size": {
    "touch": "44px",
    "control-lg": "48px",
    "cta": "52px",
    "chip": "22px",
    "bar": "6px",
    "bar-lg": "10px",
    "strip": "14px",
    "container": "1280px",
    "gutter": "28px",
    "gutter-mobile": "18px",
    "card-min": "320px",
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
} as const;

/** CSS-változó hivatkozások – inline style-ban ezt használd, így a téma-váltás működik. */
export const cssVar = {
  "color.bg.canvas": "var(--color-bg-canvas)",
  "color.bg.surface": "var(--color-bg-surface)",
  "color.bg.raised": "var(--color-bg-raised)",
  "color.bg.inset": "var(--color-bg-inset)",
  "color.bg.track": "var(--color-bg-track)",
  "color.bg.selected": "var(--color-bg-selected)",
  "color.bg.info": "var(--color-bg-info)",
  "color.border.default": "var(--color-border-default)",
  "color.border.strong": "var(--color-border-strong)",
  "color.border.info": "var(--color-border-info)",
  "color.text.primary": "var(--color-text-primary)",
  "color.text.secondary": "var(--color-text-secondary)",
  "color.text.muted": "var(--color-text-muted)",
  "color.text.inverse": "var(--color-text-inverse)",
  "color.accent.default": "var(--color-accent-default)",
  "color.accent.alt-blue": "var(--color-accent-alt-blue)",
  "color.accent.alt-amber": "var(--color-accent-alt-amber)",
  "color.accent.alt-violet": "var(--color-accent-alt-violet)",
  "color.signal.positive": "var(--color-signal-positive)",
  "color.signal.negative": "var(--color-signal-negative)",
  "color.signal.warning": "var(--color-signal-warning)",
  "color.signal.neutral": "var(--color-signal-neutral)",
  "color.data.model": "var(--color-data-model)",
  "color.data.market": "var(--color-data-market)",
  "color.data.track": "var(--color-data-track)",
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
  "color.warning-surface.bg": "var(--color-warning-surface-bg)",
  "color.warning-surface.border": "var(--color-warning-surface-border)",
  "color.overlay": "var(--color-overlay)",
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
  "font.size.h2": "var(--font-size-h2)",
  "font.size.h1-mobile": "var(--font-size-h1-mobile)",
  "font.size.h1": "var(--font-size-h1)",
  "font.size.display": "var(--font-size-display)",
  "font.size.num-s": "var(--font-size-num-s)",
  "font.size.num-m": "var(--font-size-num-m)",
  "font.size.num-l": "var(--font-size-num-l)",
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
  "space.14": "var(--space-14)",
  "space.16": "var(--space-16)",
  "space.18": "var(--space-18)",
  "space.28": "var(--space-28)",
  "radius.xs": "var(--radius-xs)",
  "radius.s": "var(--radius-s)",
  "radius.m": "var(--radius-m)",
  "radius.l": "var(--radius-l)",
  "radius.xl": "var(--radius-xl)",
  "radius.2xl": "var(--radius-2xl)",
  "radius.3xl": "var(--radius-3xl)",
  "radius.sheet": "var(--radius-sheet)",
  "radius.pill": "var(--radius-pill)",
  "size.touch": "var(--size-touch)",
  "size.control-lg": "var(--size-control-lg)",
  "size.cta": "var(--size-cta)",
  "size.chip": "var(--size-chip)",
  "size.bar": "var(--size-bar)",
  "size.bar-lg": "var(--size-bar-lg)",
  "size.strip": "var(--size-strip)",
  "size.container": "var(--size-container)",
  "size.gutter": "var(--size-gutter)",
  "size.gutter-mobile": "var(--size-gutter-mobile)",
  "size.card-min": "var(--size-card-min)",
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
