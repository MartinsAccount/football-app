// Kvíz-jellemzők (ROADMAP 12.1): egy (kérdés, opció) pár nevesített, magyar címkéjű jellemzővektora.
// Minden kérdésnél minden opció egy minta („megtenné-e ezt a tippet”), így a súlyok tipp-tulajdonságokat írnak le.
// A `phrase` tárgyesetű szókapcsolat a profil-szöveghez: „Kedveled <phrase>” / „Kerülöd <phrase>”.
import { formatOdds } from '../format/format';
import { fairProbabilities } from '../model/market';
import type { MatchResult } from '../features/types';
import type { QuizPick, QuizQuestion, QuizTeam } from './types';

export interface ProfileFeatureDef {
	key: string;
	/** Rövid magyar címke (UI-tényező). */
	label: string;
	/** Tárgyesetű szókapcsolat a profil-szöveghez. */
	phrase: string;
	/** Kapcsoló (0/1) vagy folytonos jellemző. */
	kind: 'flag' | 'value';
}

/** Odds-sávok a választott tipp nyitó oddsán: [alsó, felső). */
export const PROFILE_ODDS_BANDS: readonly (readonly [number, number])[] = [
	[1, 1.5],
	[1.5, 2],
	[2, 3],
	[3, Infinity]
];

const bandText = ([lo, hi]: readonly [number, number]) =>
	hi === Infinity
		? `${formatOdds(lo)} feletti`
		: lo === 1
		? `${formatOdds(hi)} alatti`
		: `${formatOdds(lo)}–${formatOdds(hi)} közti`;

export const PROFILE_FEATURES: readonly ProfileFeatureDef[] = [
	{ key: 'pick_home', label: 'Hazai győzelem', phrase: 'a hazai győzelmet', kind: 'flag' },
	{ key: 'pick_draw', label: 'Döntetlen', phrase: 'a döntetlent', kind: 'flag' },
	{ key: 'pick_away', label: 'Vendéggyőzelem', phrase: 'a vendéggyőzelmet', kind: 'flag' },
	{ key: 'pick_over', label: 'Gólpiac: over 2,5', phrase: 'a 2,5 gól feletti tippet', kind: 'flag' },
	{ key: 'pick_under', label: 'Gólpiac: under 2,5', phrase: 'a 2,5 gól alatti tippet', kind: 'flag' },
	{ key: 'favourite', label: 'Favorit', phrase: 'a favoritokat', kind: 'flag' },
	{ key: 'underdog', label: 'Esélytelen', phrase: 'az esélytelenebb kimenetet', kind: 'flag' },
	...PROFILE_ODDS_BANDS.map(
		(b, i): ProfileFeatureDef => ({
			key: `odds_band_${i}`,
			label: `Odds ${bandText(b).replace(' közti', '')}`,
			phrase: `a ${bandText(b)} oddsokat`,
			kind: 'flag'
		})
	),
	{ key: 'fair_prob', label: 'Piaci esély', phrase: 'a piac szerint valószínűbb tippeket', kind: 'value' },
	{ key: 'form_edge', label: 'Formaelőny', phrase: 'a jobb formában lévő csapatot', kind: 'value' },
	{ key: 'table_edge', label: 'Tabella-előny', phrase: 'a tabellán előrébb álló csapatot', kind: 'value' },
	{ key: 'balanced_draw', label: 'Kiegyenlített párharc', phrase: 'a döntetlent kiegyenlített párharcban', kind: 'value' }
];

export const PROFILE_FEATURE_COUNT = PROFILE_FEATURES.length;

/** Pont/meccs az utolsó meccsekből (W=3, D=1), 0–3; üres formánál `null`. */
export const formPointsPerGame = (form: readonly MatchResult[]): number | null => {
	if (form.length === 0) return null;
	return form.reduce((s, r) => s + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0) / form.length;
};

/** A választott oldal formaelőnye (−1…1): (ppg_saját − ppg_ellenfél) / 3. */
const formEdge = (own: QuizTeam, other: QuizTeam): number => {
	const a = formPointsPerGame(own.form);
	const b = formPointsPerGame(other.form);
	return a === null || b === null ? 0 : (a - b) / 3;
};

/** A választott oldal tabella-előnye (−1…1): (hely_ellenfél − hely_saját) / csapatszám. */
const tableEdge = (own: QuizTeam, other: QuizTeam, size: number): number =>
	own.tablePosition === null || other.tablePosition === null ? 0 : (other.tablePosition - own.tablePosition) / size;

/** Az opció nyitó oddsa és piaci fair valószínűsége; a „favorit” a piacon belül a legkisebb odds. */
export const pickMarket = (
	q: QuizQuestion,
	pick: QuizPick
): { odds: number; fairProb: number; favourite: boolean; underdog: boolean } => {
	if (pick === 'over' || pick === 'under') {
		if (!q.oddsOu25) throw new Error(`Nincs O/U 2,5 odds a(z) ${q.fixtureId} kérdéshez.`);
		const odds = [q.oddsOu25.over, q.oddsOu25.under];
		const fair = fairProbabilities(odds);
		const i = pick === 'over' ? 0 : 1;
		return { odds: odds[i], fairProb: fair[i], favourite: odds[i] < odds[1 - i], underdog: odds[i] > odds[1 - i] };
	}
	const odds = [q.odds1x2.home, q.odds1x2.draw, q.odds1x2.away];
	const fair = fairProbabilities(odds);
	const i = pick === '1' ? 0 : pick === 'X' ? 1 : 2;
	return { odds: odds[i], fairProb: fair[i], favourite: odds[i] === Math.min(...odds), underdog: odds[i] === Math.max(...odds) };
};

/** Az 1X2 favorit (legkisebb nyitó odds) – a „mindig a favorit” baseline tippje. */
export const favouritePick = (q: QuizQuestion): QuizPick => {
	const { home, draw, away } = q.odds1x2;
	const m = Math.min(home, draw, away);
	return home === m ? '1' : away === m ? '2' : 'X';
};

/** Jellemzővektor a `PROFILE_FEATURES` sorrendjében. */
export const profileFeatures = (q: QuizQuestion, pick: QuizPick): number[] => {
	const m = pickMarket(q, pick);
	const size = q.tableSize ?? 20;
	const flag = (b: boolean) => (b ? 1 : 0);
	let form = 0;
	let table = 0;
	if (pick === '1') {
		form = formEdge(q.home, q.away);
		table = tableEdge(q.home, q.away, size);
	} else if (pick === '2') {
		form = formEdge(q.away, q.home);
		table = tableEdge(q.away, q.home, size);
	}
	let balanced = 0;
	if (pick === 'X') {
		const [ph, , pa] = fairProbabilities([q.odds1x2.home, q.odds1x2.draw, q.odds1x2.away]);
		balanced = 1 - Math.abs(ph - pa);
	}
	return [
		flag(pick === '1'),
		flag(pick === 'X'),
		flag(pick === '2'),
		flag(pick === 'over'),
		flag(pick === 'under'),
		flag(m.favourite),
		flag(m.underdog),
		...PROFILE_ODDS_BANDS.map(([lo, hi]) => flag(m.odds >= lo && m.odds < hi)),
		m.fairProb,
		form,
		table,
		balanced
	];
};

/** Nevesített alak (UI/debug): `{ key → érték }`. */
export const namedProfileFeatures = (q: QuizQuestion, pick: QuizPick): Record<string, number> => {
	const x = profileFeatures(q, pick);
	return Object.fromEntries(PROFILE_FEATURES.map((f, i) => [f.key, x[i]]));
};
