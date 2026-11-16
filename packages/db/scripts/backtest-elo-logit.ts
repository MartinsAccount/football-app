// M1 összevetés (I25, ROADMAP 6.1, docs/plans/model-v1.md): `elo-logit@1.0.0` illesztés 2022–2023-on (walk-forward Elo-különbség),
// értékelés a zárolt 2024-es holdouton a v0 (`elo-poisson@0.1.0`) és a piaci nyitó/záró odds mellett. 0 élő hívás, nincs DB, nem ír fájlt.
// Futtatás: `npm run backtest:elo-logit -w @football/db`.
// TODO(polish): a CSV → BacktestMatch betöltés a `backtest.ts`-sel közös modulba (I26, backtest v1).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	eloLogitSamples,
	fitOrdinalLogit,
	ordinalLogitProbabilities,
	runBacktest,
	summarizeProbabilities,
	type BacktestMatch
} from '@football/core';
import { parseFootballDataCsv } from '../src/import/footballData';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');
const TRAIN = [2022, 2023];
const HOLDOUT = 2024;

const teamIds = new Map<string, number>();
const teamId = (name: string) => teamIds.get(name) ?? (teamIds.set(name, teamIds.size + 1), teamIds.size);
const cols = (odds: Record<string, number>, names: string[]) =>
	names.every((n) => odds[n]) ? names.map((n) => odds[n]) : undefined;

const matches: BacktestMatch[] = [];
for (const file of readdirSync(CSV_DIR)
	.filter((f) => /^[A-Z0-9]+-\d{4}\.csv$/.test(f))
	.sort()) {
	const [div, yy] = file.replace('.csv', '').split('-');
	for (const row of parseFootballDataCsv(readFileSync(join(CSV_DIR, file), 'utf8'))) {
		if (row.goalsHome === null || row.goalsAway === null) continue;
		const o = row.odds;
		matches.push({
			id: matches.length + 1,
			kickoff: `${row.date}T12:00:00Z`,
			homeTeamId: teamId(row.home),
			awayTeamId: teamId(row.away),
			homeGoals: row.goalsHome,
			awayGoals: row.goalsAway,
			league: div,
			season: 2000 + Number(yy.slice(0, 2)),
			odds: { h2h: { marketOpening: cols(o, ['AvgH', 'AvgD', 'AvgA']), marketClosing: cols(o, ['AvgCH', 'AvgCD', 'AvgCA']) } }
		});
	}
}

const { samples } = eloLogitSamples(matches, () => true);
const seasonOf = new Map(matches.map((m) => [m.id, m.season]));
const train = samples.filter((s) => TRAIN.includes(seasonOf.get(s.id)!));
const fit = fitOrdinalLogit(train);
const logitById = new Map(samples.filter((s) => seasonOf.get(s.id) === HOLDOUT).map((s) => [s.id, s.diff]));

// v0 rekordok a holdoutra; páros összevetés: csak nyitó + záró oddsszal rendelkező meccsek.
const records = runBacktest(matches, { evalSeasons: [HOLDOUT] }).filter((r) => r.marketOpening.h2h && r.marketClosing.h2h);
const summary = (pick: (r: (typeof records)[number]) => number[]) =>
	summarizeProbabilities(records.map((r) => ({ probabilities: pick(r), outcomeIndex: r.outcome.h2h })));
const logit = summary((r) => {
	const p = ordinalLogitProbabilities(logitById.get(r.id)!, fit.params);
	return [p.home, p.draw, p.away];
});
const rows: Array<[string, ReturnType<typeof summary>]> = [
	['elo-logit@1.0.0 (M1)', logit],
	['elo-poisson@0.1.0 (v0)', summary((r) => r.model.h2h)],
	['piac nyitó', summary((r) => r.marketOpening.h2h!)],
	['piac záró', summary((r) => r.marketClosing.h2h!)]
];
const f4 = (x: number | null) => (x === null ? '–' : x.toFixed(4).replace('.', ','));
console.log(
	`Illesztés ${TRAIN.join('–')} (n=${train.length}, ${fit.iterations} iteráció, konvergált: ${fit.converged}): β=${f4(
		fit.params.beta
	)}, c1=${f4(fit.params.cut1)}, c2=${f4(fit.params.cut2)}, tanító LL=${f4(fit.logLoss)}`
);
console.log(`Holdout ${HOLDOUT}, 1X2, páros n=${records.length}`);
console.log('| Modell | LL | Brier |\n|---|--:|--:|');
for (const [name, s] of rows) console.log(`| ${name} | ${f4(s.meanLogLoss)} | ${f4(s.meanBrier)} |`);
