// football-data.co.uk CSV-odds import (ROADMAP 4.2, S11b): `data/history/football-data/<div>-<yyyy>.csv` →
// `odds_snapshot(source='football-data-csv', kind=opening_csv|closing_csv)` a már importált API-Football meccsekre.
// Tiszta függvények (parser, csapatnév-párosítás, snapshot-képzés); az I/O a `scripts/import-odds-csv.ts`-ben.
import type { Bookmaker, Fixture, Market, OddsQuote, OddsSnapshotInput, Team, TeamAlias } from '../types';

export const CSV_SOURCE = 'football-data-csv';

/** CSV divízió → API-Football liga-id (data/history/README.md). */
export const DIV_LEAGUE: Record<string, number> = { E0: 39, F1: 61, D1: 78, I1: 135, SP1: 140 };

/** API-Football azonosítók: Bet365 = 8, Pinnacle = 4; az átlag/maximum szintetikus „iroda” (DECISIONS 2026-11-12). */
export const CSV_BOOKMAKERS: Bookmaker[] = [
	{ id: 8, name: 'Bet365', stored: true },
	{ id: 4, name: 'Pinnacle', stored: true },
	{ id: 900001, name: 'Piaci átlag (football-data)', stored: true },
	{ id: 900002, name: 'Piaci maximum (football-data)', stored: true }
];
/** API-Football piac-id-k: 1 = Match Winner (Home/Draw/Away), 5 = Goals Over/Under. */
export const CSV_MARKETS: Market[] = [
	{ id: 1, name: 'Match Winner', stored: true },
	{ id: 5, name: 'Goals Over/Under', stored: true }
];

/** Nyitó/záró oszlop-előtagok irodánként (1X2: `<p>H/D/A`, O/U 2.5: `<p>>2.5` / `<p><2.5`). */
const COLUMNS: { bookmakerId: number; open1x2: string; close1x2: string; openOu: string; closeOu: string }[] = [
	{ bookmakerId: 8, open1x2: 'B365', close1x2: 'B365C', openOu: 'B365', closeOu: 'B365C' },
	{ bookmakerId: 4, open1x2: 'PS', close1x2: 'PSC', openOu: 'P', closeOu: 'PC' },
	{ bookmakerId: 900001, open1x2: 'Avg', close1x2: 'AvgC', openOu: 'Avg', closeOu: 'AvgC' },
	{ bookmakerId: 900002, open1x2: 'Max', close1x2: 'MaxC', openOu: 'Max', closeOu: 'MaxC' }
];

/** A nyitó odds időpontja nem ismert (football-data: péntek délután / kedd); közelítés: kezdés − 48 óra. */
export const OPENING_OFFSET_MS = 48 * 3600 * 1000;

export interface CsvMatchRow {
	div: string;
	date: string; // YYYY-MM-DD (a CSV dd/mm/yyyy, angol helyi idő)
	home: string;
	away: string;
	goalsHome: number | null;
	goalsAway: number | null;
	/** Nyers oszlop → szám; üres/hiányzó cella nincs benne. */
	odds: Record<string, number>;
}

/** Egy football-data CSV → meccssorok. BOM-, üres sor- és csonka sor-tűrő; a fájlokban nincs idézőjeles mező. */
export function parseFootballDataCsv(text: string): CsvMatchRow[] {
	const lines = text.replace(/^﻿/, '').split(/\r?\n/);
	const header = lines[0].split(',').map((h) => h.trim());
	const idx = (name: string) => header.indexOf(name);
	const [iDiv, iDate, iHome, iAway, iFthg, iFtag] = ['Div', 'Date', 'HomeTeam', 'AwayTeam', 'FTHG', 'FTAG'].map(idx);
	const rows: CsvMatchRow[] = [];
	for (const line of lines.slice(1)) {
		const cells = line.split(',');
		const home = cells[iHome]?.trim();
		const away = cells[iAway]?.trim();
		if (!home || !away) continue;
		const odds: Record<string, number> = {};
		header.forEach((h, i) => {
			const raw = cells[i]?.trim();
			if (!raw) return;
			const n = Number(raw);
			if (Number.isFinite(n) && n > 1) odds[h] = n;
		});
		rows.push({
			div: cells[iDiv].trim(),
			date: parseCsvDate(cells[iDate]),
			home,
			away,
			goalsHome: toInt(cells[iFthg]),
			goalsAway: toInt(cells[iFtag]),
			odds
		});
	}
	return rows;
}

function toInt(raw: string | undefined): number | null {
	const n = Number(raw?.trim());
	return raw?.trim() && Number.isInteger(n) ? n : null;
}

/** `dd/mm/yyyy` vagy `dd/mm/yy` → `YYYY-MM-DD`. */
export function parseCsvDate(raw: string): string {
	const [d, m, y] = raw.trim().split('/');
	const year = y.length === 2 ? `20${y}` : y;
	return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Névnormalizálás: kisbetű, ékezet nélkül, írásjel és gyakori klub-előtag/utótag nélkül. */
export function normalizeTeamName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9 ]/g, ' ')
		.split(/\s+/)
		.filter((w) => w && !['fc', 'cf', 'ac', 'as', 'sc', 'afc', 'vfl', 'vfb', 'sv', 'ssc', '1'].includes(w))
		.join(' ');
}

export interface MatchResult {
	matched: { row: CsvMatchRow; fixture: Fixture }[];
	unmatched: CsvMatchRow[];
	/** CSV-név → csapat-id (a meglévő és az újonnan kikövetkeztetett aliasok együtt). */
	aliases: TeamAlias[];
}

const DAY_MS = 86400000;
const dayDiff = (isoDate: string, kickoffAt: string) =>
	Math.abs(Date.parse(`${isoDate}T12:00:00Z`) - Date.parse(kickoffAt)) / DAY_MS;

/**
 * CSV-sorok párosítása egy liga-szezon meccseire: liga + dátum (±1 nap, a CSV angol helyi idő) + csapat.
 * Csapatnév-feloldás: (1) meglévő alias, (2) normalizált névegyezés a szezon csapatai közt, (3) ellenfél-alapú
 * következtetés: ha a sor egyik csapata ismert és aznap egyetlen ilyen meccse van, a másik név annak ellenfele
 * (többségi szavazás, ismétlés konvergenciáig).
 */
export function matchCsvRows(rows: CsvMatchRow[], fixtures: Fixture[], teams: Team[], known: TeamAlias[] = []): MatchResult {
	const seasonTeamIds = new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]));
	const seasonTeams = teams.filter((t) => seasonTeamIds.has(t.id));
	const alias = new Map<string, number>(known.filter((a) => seasonTeamIds.has(a.teamId)).map((a) => [a.name, a.teamId]));
	const byNorm = new Map<string, number[]>();
	for (const t of seasonTeams) byNorm.set(normalizeTeamName(t.name), [...(byNorm.get(normalizeTeamName(t.name)) ?? []), t.id]);
	for (const name of new Set(rows.flatMap((r) => [r.home, r.away]))) {
		const ids = byNorm.get(normalizeTeamName(name));
		if (!alias.has(name) && ids?.length === 1) alias.set(name, ids[0]);
	}
	const near = (r: CsvMatchRow) => fixtures.filter((f) => dayDiff(r.date, f.kickoffAt) <= 1);

	for (let changed = true; changed; ) {
		changed = false;
		const votes = new Map<string, Map<number, number>>();
		const vote = (name: string, id: number) => {
			const v = votes.get(name) ?? new Map<number, number>();
			v.set(id, (v.get(id) ?? 0) + 1);
			votes.set(name, v);
		};
		for (const r of rows) {
			const h = alias.get(r.home);
			const a = alias.get(r.away);
			if ((h === undefined) === (a === undefined)) continue;
			const cands = near(r).filter((f) => (h !== undefined ? f.homeTeamId === h : f.awayTeamId === a));
			if (cands.length !== 1) continue;
			if (h === undefined) vote(r.home, cands[0].homeTeamId);
			else vote(r.away, cands[0].awayTeamId);
		}
		for (const [name, v] of votes) {
			const [best] = [...v].sort((x, y) => y[1] - x[1]);
			const taken = new Set(alias.values());
			if (!taken.has(best[0])) {
				alias.set(name, best[0]);
				changed = true;
			}
		}
	}

	const matched: MatchResult['matched'] = [];
	const unmatched: CsvMatchRow[] = [];
	for (const r of rows) {
		const h = alias.get(r.home);
		const a = alias.get(r.away);
		const fixture = near(r).find((f) => f.homeTeamId === h && f.awayTeamId === a);
		if (fixture) matched.push({ row: r, fixture });
		else unmatched.push(r);
	}
	const aliases = [...alias].map(([name, teamId]) => ({ source: CSV_SOURCE, name, teamId }));
	return { matched, unmatched, aliases };
}

/** Egy párosított sor → nyitó és záró snapshot (üres oldal kimarad). `captured_at`: záró = kezdés, nyitó = kezdés − 48 h. */
export function csvRowSnapshots(row: CsvMatchRow, fixture: Fixture): OddsSnapshotInput[] {
	const kickoff = Date.parse(fixture.kickoffAt);
	const build = (closing: boolean): OddsSnapshotInput => {
		const quotes: OddsQuote[] = [];
		for (const c of COLUMNS) {
			const p1 = closing ? c.close1x2 : c.open1x2;
			const pOu = closing ? c.closeOu : c.openOu;
			const push = (marketId: number, selection: string, line: number | null, col: string) => {
				const odd = row.odds[col];
				if (odd !== undefined) quotes.push({ bookmakerId: c.bookmakerId, marketId, selection, line, odd });
			};
			push(1, 'Home', null, `${p1}H`);
			push(1, 'Draw', null, `${p1}D`);
			push(1, 'Away', null, `${p1}A`);
			push(5, 'Over', 2.5, `${pOu}>2.5`);
			push(5, 'Under', 2.5, `${pOu}<2.5`);
		}
		return {
			fixtureId: fixture.id,
			capturedAt: new Date(closing ? kickoff : kickoff - OPENING_OFFSET_MS).toISOString(),
			source: CSV_SOURCE,
			kind: closing ? 'closing_csv' : 'opening_csv',
			quotes
		};
	};
	return [build(false), build(true)].filter((s) => s.quotes.length > 0);
}
