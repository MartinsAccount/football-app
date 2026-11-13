/**
 * Appsaját elemek, amelyekhez a Floodlight v0.2 `components.css` (vendor) nem ad osztályt.
 * ADR-0009: ezek Tailwind-utilityk, kizárólag tokenre mutató theme-kulcsokkal (`tailwind.config.cjs`).
 * TODO(polish): az S26–S30 oldal-átrendezésnél, ahol a v0.2 referencia ad osztályt, arra cserélni.
 */

/** Feltételes osztálylista összefűzése. */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');

/** Általános kártya (a v0.1 `.oe-card` helyett, ahol nem tippkártya). */
export const card = 'flex flex-col gap-sp-7 rounded-2xl border border-border-default bg-surface p-sp-9 shadow-card';

/** Kártyarács (a v0.1 `.oe-card-grid` helyett). */
export const cardGrid = 'grid gap-sp-6 grid-cols-[repeat(auto-fill,minmax(min(100%,var(--size-aside-basis)),1fr))]';

/** Kis mérőszám: címke + érték (a v0.1 `.oe-stat__*` helyett). */
export const statLabel = 'text-micro text-text-muted';
export const statValue = 'font-bold tabular-nums';

/** Kis állapotjelző pötty + szöveg (a v0.1 `.oe-status` helyett). */
export const statusDot =
	"inline-flex items-center gap-sp-4 text-small text-text-muted before:content-[''] before:h-sp-4 before:w-sp-4 before:rounded-pill before:bg-accent";

/** Szöveges beviteli mező (a v0.1 `.oe-input` helyett). */
export const input =
	'min-h-touch w-full rounded-l border border-border-strong bg-canvas px-sp-5 text-num-s font-bold text-text-primary aria-[invalid=true]:border-negative data-[valid=true]:border-accent';

/** Bekapcsolható gomb (`aria-pressed`) – semleges kiválasztás (DESIGN §1.3). Az `oe-btn` mellé. */
export const toggleBtn = 'aria-pressed:border-on-bg aria-pressed:bg-on-bg aria-pressed:text-on-fg';

/** Keretes figyelmeztetés (a v0.1 `.oe-warning--box` / `--danger` helyett). Az `oe-warning` mellé. */
export const warningBox = 'rounded-l border border-tint-warning-border bg-tint-warning px-sp-6 py-sp-5';
export const dangerBox = 'rounded-l border border-tint-negative-border bg-tint-negative px-sp-6 py-sp-5 text-negative-text';
export const dangerText = 'text-negative-text';

/** Megjegyzés-doboz a szelvényben (a v0.1 `.oe-slip__note` helyett). */
export const note = 'rounded-l bg-inset px-sp-7 py-sp-6 text-caption text-text-secondary';

/** Mobil szelvény-sáv (< 640 px; a v0.1 `.oe-slipbar*` helyett) – a lista alatti panelre ugrik. */
export const slipBar =
	'fixed inset-x-sp-6 bottom-sp-8 z-20 flex min-h-cta items-center gap-sp-6 rounded-4xl bg-accent py-sp-5 pl-sp-9 pr-sp-5 text-accent-on sm:hidden';
export const slipBarBody = 'flex min-w-0 flex-auto flex-col text-small [&_strong]:truncate';
export const slipBarSpacer = 'h-[calc(var(--size-cta)+var(--space-16))] shrink-0 basis-full sm:hidden';
