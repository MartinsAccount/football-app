// Magyar szám- és szövegformázás (DESIGN.md §8). A komponens sosem hív toFixed-et: mindent innen kap.

/** Nem törő szóköz: ezres elválasztó és szám–mértékegység közé. */
export const NBSP = ' ';
/** Valódi mínuszjel (nem kötőjel). */
export const MINUS = '−';
/** Nagykötőjel (eredmény, párosítás). */
export const EN_DASH = '–';

export const DEFAULT_TIME_ZONE = 'Europe/Budapest';

const numberFormats = new Map<number, Intl.NumberFormat>();

/** Abszolút érték `decimals` tizedesre, vesszővel, ezres NBSP-csoportosítással (a hu-HU Intl a 4 jegyűt nem csoportosítja). */
const formatAbs = (value: number, decimals: number): string => {
	let nf = numberFormats.get(decimals);
	if (!nf) {
		nf = new Intl.NumberFormat('hu-HU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false });
		numberFormats.set(decimals, nf);
	}
	const [int, frac] = nf.format(Math.abs(value)).split(',');
	const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
	return frac === undefined ? grouped : `${grouped},${frac}`;
};

/** Előjeles szám: `+`, valódi `−`; a nullára kerekített érték előjel nélküli. */
const formatSigned = (value: number, decimals: number): string => {
	const body = formatAbs(value, decimals);
	const isZero = Number(body.replace(/ /g, '').replace(',', '.')) === 0;
	if (isZero) return body;
	return (value < 0 ? MINUS : '+') + body;
};

/** Odds: 2 tizedes, vessző. `1.8` → `1,80`. */
export const formatOdds = (odds: number): string => formatAbs(odds, 2);

/** Valószínűség (0–1) egész %-ban. `0.613` → `61%`. */
export const formatPercent = (probability: number): string => {
	const pct = Math.round(probability * 100);
	return (pct < 0 ? MINUS : '') + formatAbs(pct, 0) + '%';
};

/** Különbség százalékpontban (már pp-ben), egészre, előjellel. `7` → `+7 pp`. */
export const formatPp = (pp: number): string => `${formatSigned(Math.round(pp), 0)}${NBSP}pp`;

/** EV (arány, pl. `0.10`) egész %-ban, előjellel. `0.1` → `+10%`, `-0.03` → `−3%`. */
export const formatEv = (ev: number): string => `${formatSigned(Math.round(ev * 100), 0)}%`;

/** Pénz: egész Ft, ezres NBSP. `3096` → `3 096 Ft`. */
export const formatFt = (amount: number): string => {
	const rounded = Math.round(amount);
	return `${rounded < 0 ? MINUS : ''}${formatAbs(rounded, 0)}${NBSP}Ft`;
};

/** Egység: 1 tizedes, előjellel. `0.9` → `+0,9 egység`. */
export const formatUnits = (units: number): string => `${formatSigned(units, 1)}${NBSP}egység`;

const WEEKDAY_SHORT: Record<string, string> = {
	Mon: 'H',
	Tue: 'K',
	Wed: 'Sze',
	Thu: 'Cs',
	Fri: 'P',
	Sat: 'Szo',
	Sun: 'V'
};

interface ZonedParts {
	year: number;
	month: number;
	day: number;
	hour: string;
	minute: string;
	weekday: string;
}

const zonedParts = (date: Date, timeZone: string): ZonedParts => {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		weekday: 'short'
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: get('hour'),
		minute: get('minute'),
		weekday: get('weekday')
	};
};

/** Naptári napok különbsége (a zóna szerinti dátumokból, DST-független). */
const dayDiff = (a: ZonedParts, b: ZonedParts) =>
	(Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86_400_000;

/** Kezdési időpont: `ma 15:00`, `holnap 18:30`, egyébként `V 14:00`. */
export const formatKickoff = (kickoff: Date, now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string => {
	const k = zonedParts(kickoff, timeZone);
	const diff = dayDiff(k, zonedParts(now, timeZone));
	const time = `${k.hour}:${k.minute}`;
	if (diff === 0) return `ma ${time}`;
	if (diff === 1) return `holnap ${time}`;
	return `${WEEKDAY_SHORT[k.weekday] ?? k.weekday} ${time}`;
};

/** Dátum (H2H): `ÉÉÉÉ.HH`. */
export const formatYearMonth = (date: Date, timeZone: string = DEFAULT_TIME_ZONE): string => {
	const p = zonedParts(date, timeZone);
	return `${p.year}.${String(p.month).padStart(2, '0')}`;
};

/** Eredmény nagykötőjellel: `2–0`. */
export const formatScore = (home: number, away: number): string => `${home}${EN_DASH}${away}`;

/** Párosítás: `Arsenal – Chelsea`. */
export const formatPairing = (home: string, away: string): string => `${home} ${EN_DASH} ${away}`;

/** Adat kora melléknévként: < 48 óra → `30 órás`, különben `3 napos`. (Mondat: „Az odds 30 órás”.) */
export const formatAge = (ageMs: number): string => {
	const hours = Math.max(0, Math.floor(ageMs / 3_600_000));
	if (hours < 48) return `${hours}${NBSP}órás`;
	return `${Math.floor(hours / 24)}${NBSP}napos`;
};
