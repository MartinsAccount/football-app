import { buildBacktestReport, runBacktest, type BacktestMatch } from './backtest';

const day = (d: number) => new Date(Date.UTC(2022, 7, 1) + d * 86_400_000).toISOString();

// 4 csapat, a 1-es erős; két „szezon” (a 2. szezon kezdete > 45 nap szünet után).
const make = (): BacktestMatch[] => {
	const ms: BacktestMatch[] = [];
	let id = 1;
	for (let round = 0; round < 12; round++) {
		const season = round < 6 ? 2022 : 2023;
		const kickoff = day(round * 7 + (season === 2023 ? 60 : 0));
		const pairs: [number, number][] =
			round % 2
				? [
						[1, 2],
						[3, 4]
				  ]
				: [
						[2, 3],
						[4, 1]
				  ];
		for (const [h, a] of pairs) {
			const strong = h === 1 || a === 1;
			const [hg, ag] = strong ? (h === 1 ? [3, 0] : [0, 2]) : [1, 1];
			ms.push({
				id: id++,
				kickoff,
				homeTeamId: h,
				awayTeamId: a,
				homeGoals: hg,
				awayGoals: ag,
				league: 'X',
				season,
				odds: {
					h2h: {
						taken: [2.5, 3.4, 3.0],
						takenClosing: [2.4, 3.4, 3.1],
						marketOpening: [2.4, 3.3, 2.9],
						marketClosing: [2.3, 3.3, 3.0]
					},
					ou25: { taken: [1.9, 1.9], marketOpening: [1.9, 1.9], marketClosing: [1.85, 1.95] }
				}
			});
		}
	}
	return ms;
};

describe('runBacktest', () => {
	it('csak az értékelt szezonra jósol, a meccsek sorrendjétől függetlenül, determinisztikusan', () => {
		const ms = make();
		const a = runBacktest(ms, { evalSeasons: [2023] });
		const b = runBacktest([...ms].reverse(), { evalSeasons: [2023] });
		expect(a).toHaveLength(12);
		expect(a.every((r) => r.season === 2023)).toBe(true);
		expect(b).toEqual(a);
	});

	it('nem lát a jövőbe: egy későbbi eredmény átírása nem változtat a korábbi predikción', () => {
		const ms = make();
		const before = runBacktest(ms, { evalSeasons: [2023] });
		const last = ms[ms.length - 1];
		const changed = ms.map((m) => (m.id === last.id ? { ...m, homeGoals: 9, awayGoals: 0 } : m));
		const after = runBacktest(changed, { evalSeasons: [2023] });
		expect(after.slice(0, -2).map((r) => r.model)).toEqual(before.slice(0, -2).map((r) => r.model));
	});

	it('a bemelegítés után az erős csapatot favorizálja, a valószínűségek összege 1', () => {
		const recs = runBacktest(make(), { evalSeasons: [2023] });
		const src = new Map(make().map((m) => [m.id, m]));
		const strongHome = recs.filter((x) => src.get(x.id)!.homeTeamId === 1);
		expect(strongHome.length).toBeGreaterThan(0);
		for (const x of strongHome) expect(x.model.h2h[0]).toBeGreaterThan(x.model.h2h[2]);
		const r = recs[0];
		expect(r.model.h2h.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 6);
		expect(r.marketOpening.h2h!.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 9);
	});

	it('értéktipp csak a küszöb fölött, a legnagyobb EV-jű kimenetre, CLV-vel', () => {
		const recs = runBacktest(make(), { evalSeasons: [2023], evThreshold: 0.05 });
		for (const r of recs) {
			const bet = r.bets.h2h;
			if (!bet) continue;
			expect(bet.ev).toBeGreaterThanOrEqual(0.05);
			expect(bet.ev).toBeCloseTo(bet.p! * bet.odds - 1, 9);
			expect(bet.closingOdds).toBe([2.4, 3.4, 3.1][bet.selection]);
			expect(bet.outcome).toBe(bet.selection === r.outcome.h2h ? 'win' : 'loss');
		}
		const none = runBacktest(make(), { evalSeasons: [2023], evThreshold: 10 });
		expect(none.every((r) => !r.bets.h2h && !r.bets.ou25)).toBe(true);
	});
});

describe('buildBacktestReport', () => {
	it('összesít: páros összevetés, szezon- és ligabontás, kalibráció', () => {
		const opts = { evalSeasons: [2022, 2023] };
		const report = buildBacktestReport(runBacktest(make(), opts), opts);
		expect(report.matches).toBe(24);
		expect(Object.keys(report.bySeason)).toEqual(['2022', '2023']);
		expect(Object.keys(report.byLeague)).toEqual(['X']);
		expect(report.overall.h2h.model.n).toBe(24);
		expect(report.overall.h2h.marketClosing.meanLogLoss).not.toBeNull();
		expect(report.calibration.h2h.reduce((s, b) => s + b.count, 0)).toBe(72);
		expect(report.calibration.ou25.reduce((s, b) => s + b.count, 0)).toBe(48);
	});
});
