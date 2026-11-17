import {
	buildOwnerProfile,
	crossValidateProfile,
	deriveStandings,
	teamForm,
	type PlayedMatch,
	type ProfileSample,
	type QuizAnswer,
	type QuizPick,
	type QuizQuestion
} from '@football/core';
import { SqlOwnerAnswerRepository, type OwnerAnswerRepository, type SqlExecutor } from '@football/db';
import type { ProfileResponse, QuizAnswerResponse, QuizResultDto } from '@football/contract';

/**
 * Saját stílus API (ROADMAP 12.2, Q2; terv: docs/plans/owner-style-and-draws.md A). `GET /api/quiz/next` egy még meg nem
 * válaszolt, lejátszott, nyitó 1X2-oddsszal rendelkező meccset ad `QuizQuestion`-ként; `POST /api/quiz/answer` ment és
 * visszaadja a valós eredményt; `GET /api/profile` a core `buildOwnerProfile`-t futtatja a kvízválaszokon + a leképezhető
 * egylábú saját fogadásokon. 0 külső hívás. Hibás törzs → `QuizValidationError` (a router 400-ra fordítja).
 */
export class QuizValidationError extends Error {}

export interface QuizService {
	/** `seed` megadásával determinisztikus; `null` → véletlen. Nincs több jelölt → `null`. */
	next(seed: number | null): Promise<QuizQuestion | null>;
	answer(body: unknown): Promise<QuizAnswerResponse>;
	profile(): Promise<ProfileResponse>;
}

const FINISHED = ['FT', 'AET', 'PEN'];
const FORM_N = 5;
/** `next`: ennyi jelöltet tölt be egyszerre (többnyire már az első használható). */
const NEXT_BATCH = 8;
const PICKS = new Set(['1', 'X', '2', 'over', 'under', 'skip']);
/** Nyitó odds forrása: előbb a CSV-átlag (900001), aztán Bet365, Pinnacle, más iroda, végül a CSV-maximum. */
const BOOKMAKER_RANK = `CASE q.bookmaker_id WHEN 900001 THEN 0 WHEN 8 THEN 1 WHEN 4 THEN 2 WHEN 900002 THEN 9 ELSE 3 END`;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Kvíz-válasz törzs validálása. */
export function parseQuizAnswer(body: unknown): QuizAnswer {
	if (!isObject(body)) throw new QuizValidationError('A törzs objektum legyen');
	const { fixtureId, pick, confidence } = body;
	if (!(typeof fixtureId === 'number' && Number.isSafeInteger(fixtureId) && fixtureId > 0))
		throw new QuizValidationError("'fixtureId' pozitív egész legyen");
	if (typeof pick !== 'string' || !PICKS.has(pick))
		throw new QuizValidationError("'pick' értéke 1 | X | 2 | over | under | skip legyen");
	if (confidence !== undefined && confidence !== null && confidence !== 1 && confidence !== 2 && confidence !== 3)
		throw new QuizValidationError("'confidence' 1, 2 vagy 3 legyen (vagy hiányozzon)");
	return { fixtureId, pick: pick as QuizAnswer['pick'], ...(confidence ? { confidence } : {}) };
}

/** Egy lejátszott meccs eredménye; `null`, ha a meccs nem létezik vagy nincs vége. */
async function loadResult(db: SqlExecutor, fixtureId: number): Promise<QuizResultDto | null> {
	const { rows } = await db.query<{ gh: number; ga: number }>(
		`SELECT goals_home AS gh, goals_away AS ga FROM fixture
		 WHERE id = $1 AND status = ANY($2::text[]) AND goals_home IS NOT NULL AND goals_away IS NOT NULL`,
		[fixtureId, FINISHED]
	);
	if (!rows.length) return null;
	const { gh, ga } = rows[0];
	return { homeGoals: gh, awayGoals: ga, outcome: gh > ga ? '1' : gh < ga ? '2' : 'X', over25: gh + ga > 2.5 };
}

const isCorrect = (pick: QuizAnswer['pick'], r: QuizResultDto): boolean | null =>
	pick === 'skip' ? null : pick === 'over' ? r.over25 : pick === 'under' ? !r.over25 : pick === r.outcome;

type OpeningOdds = { odds1x2: QuizQuestion['odds1x2'] | null; oddsOu25: QuizQuestion['oddsOu25'] };

/**
 * Nyitó odds meccsenként: a `opening_csv` snapshot, ennek hiányában a kezdés előtti legkorábbi; irodánként az első teljes sor.
 * Egy lekérdezés az összes meccsre (Q3b).
 */
async function openingOddsBatch(db: SqlExecutor, fixtures: { id: number; kickoff: string }[]): Promise<Map<number, OpeningOdds>> {
	const { rows } = await db.query<{ fx: number; sid: number; b: number; m: number; s: string; odd: number }>(
		`SELECT s.fixture_id::float8 AS fx, s.id::float8 AS sid, q.bookmaker_id::float8 AS b, q.market_id::float8 AS m, q.selection AS s,
			q.odd::float8 AS odd
		 FROM unnest($1::bigint[], $2::timestamptz[]) AS t(fid, k)
			JOIN odds_snapshot s ON s.fixture_id = t.fid JOIN odds_quote q ON q.snapshot_id = s.id
		 WHERE (s.kind = 'opening_csv' OR s.captured_at <= t.k)
			AND ((q.market_id = 1 AND q.line IS NULL) OR (q.market_id = 5 AND q.line = 2.5))
		 ORDER BY s.fixture_id, (s.kind = 'opening_csv') DESC, s.captured_at, s.id, ${BOOKMAKER_RANK}, q.bookmaker_id`,
		[fixtures.map((f) => f.id), fixtures.map((f) => f.kickoff)]
	);
	const byFixture = new Map<number, Map<string, Map<string, number>>>(); // beszúrási sorrend = prioritás
	for (const r of rows) {
		const groups = byFixture.get(r.fx) ?? byFixture.set(r.fx, new Map()).get(r.fx)!;
		const key = `${r.m}|${r.sid}|${r.b}`;
		(groups.get(key) ?? groups.set(key, new Map()).get(key)!).set(r.s, r.odd);
	}
	const out = new Map<number, OpeningOdds>();
	for (const [fx, groups] of byFixture) {
		const first = (market: number, sels: string[]) => {
			for (const [key, g] of groups)
				if (key.startsWith(`${market}|`) && sels.every((x) => (g.get(x) ?? 0) > 1)) return sels.map((x) => g.get(x)!);
			return null;
		};
		const x12 = first(1, ['Home', 'Draw', 'Away']);
		const ou = first(5, ['Over', 'Under']);
		out.set(fx, {
			odds1x2: x12 && { home: x12[0], draw: x12[1], away: x12[2] },
			oddsOu25: ou && { over: ou[0], under: ou[1] }
		});
	}
	return out;
}

type PlayedRow = { id: number; k: unknown; h: number; a: number; gh: number; ga: number };
const toPlayed = (r: PlayedRow): PlayedMatch => ({
	id: r.id,
	kickoff: new Date(r.k as string).toISOString(),
	homeTeamId: r.h,
	awayTeamId: r.a,
	homeGoals: r.gh,
	awayGoals: r.ga
});
const PLAYED_COLS = `id::float8 AS id, kickoff_at AS k, home_team_id::float8 AS h, away_team_id::float8 AS a, goals_home AS gh,
	goals_away AS ga`;
const DONE = `status = ANY($3::text[]) AND goals_home IS NOT NULL AND goals_away IS NOT NULL`;

/** Egy meccs `QuizQuestion`-ként; a kötegelt `loadQuizQuestions` egyelemű esete. */
export async function loadQuizQuestion(db: SqlExecutor, fixtureId: number): Promise<QuizQuestion | null> {
	return (await loadQuizQuestions(db, [fixtureId])).get(fixtureId) ?? null;
}

/**
 * Meccsek `QuizQuestion`-ként, kötegelten (Q3b: 4 lekérdezés a meccsek számától függetlenül, a számolás memóriában).
 * Forma: utolsó 5 bármely sorozatban a kezdés előtt; tabella: a liga-szezon meccseiből a kezdés előtt. Nyitó 1X2-odds nélküli
 * vagy nem létező meccs kimarad a térképből.
 */
export async function loadQuizQuestions(db: SqlExecutor, fixtureIds: readonly number[]): Promise<Map<number, QuizQuestion>> {
	const out = new Map<number, QuizQuestion>();
	if (!fixtureIds.length) return out;
	const { rows: heads } = await db.query<{
		id: number;
		l: number;
		ln: string;
		s: number;
		k: unknown;
		h: number;
		hn: string;
		a: number;
		an: string;
	}>(
		`SELECT f.id::float8 AS id, f.league_id::float8 AS l, lg.name AS ln, f.season AS s, f.kickoff_at AS k,
			f.home_team_id::float8 AS h, ht.name AS hn, f.away_team_id::float8 AS a, at.name AS an
		 FROM fixture f JOIN league lg ON lg.id = f.league_id JOIN team ht ON ht.id = f.home_team_id JOIN team at ON at.id = f.away_team_id
		 WHERE f.id = ANY($1::bigint[])`,
		[[...new Set(fixtureIds)]]
	);
	const kickoffOf = (k: unknown) => new Date(k as string).toISOString();
	const oddsMap = await openingOddsBatch(
		db,
		heads.map((f) => ({ id: f.id, kickoff: kickoffOf(f.k) }))
	);
	const withOdds = heads.filter((f) => oddsMap.get(f.id)?.odds1x2);
	if (!withOdds.length) return out;

	// Liga-szezonok összes meccse (tabella) egy lekérdezésben.
	const pairs = [...new Map(withOdds.map((f) => [`${f.l}|${f.s}`, f])).values()];
	const { rows: seasonRows } = await db.query<PlayedRow & { l: number; s: number; done: boolean }>(
		`SELECT league_id::float8 AS l, season AS s, ${PLAYED_COLS}, (${DONE}) AS done
		 FROM fixture WHERE (league_id, season) IN (SELECT * FROM unnest($1::bigint[], $2::int[]))`,
		[pairs.map((f) => f.l), pairs.map((f) => f.s), FINISHED]
	);
	const seasons = new Map<string, { played: PlayedMatch[]; teamIds: number[] }>();
	for (const r of seasonRows) {
		const key = `${r.l}|${r.s}`;
		const g = seasons.get(key) ?? seasons.set(key, { played: [], teamIds: [] }).get(key)!;
		if (r.done) g.played.push(toPlayed(r));
		g.teamIds.push(r.h, r.a);
	}

	// Az érintett csapatok lejátszott meccsei (forma) egy lekérdezésben, csapatonként kezdés szerint csökkenőben.
	const teams = [...new Set(withOdds.flatMap((f) => [f.h, f.a]))];
	const { rows: teamRows } = await db.query<PlayedRow>(
		`SELECT ${PLAYED_COLS} FROM fixture
		 WHERE (home_team_id = ANY($1::bigint[]) OR away_team_id = ANY($2::bigint[])) AND ${DONE}
		 ORDER BY kickoff_at DESC, id DESC`,
		[teams, teams, FINISHED]
	);
	const byTeam = new Map<number, PlayedMatch[]>();
	for (const r of teamRows) {
		const m = toPlayed(r);
		for (const t of new Set([r.h, r.a])) (byTeam.get(t) ?? byTeam.set(t, []).get(t)!).push(m);
	}

	for (const f of withOdds) {
		const kickoff = kickoffOf(f.k);
		const odds = oddsMap.get(f.id)!;
		const season = seasons.get(`${f.l}|${f.s}`) ?? { played: [], teamIds: [] };
		const teamIds = [...new Set(season.teamIds)];
		const table = deriveStandings(season.played, kickoff, teamIds);
		const position = (teamId: number) => {
			const row = table.find((r) => r.teamId === teamId);
			return row && row.played > 0 ? row.position : null;
		};
		const team = (id: number, name: string) => {
			const last = (byTeam.get(id) ?? []).filter((m) => m.kickoff < kickoff).slice(0, FORM_N);
			const form = teamForm(last, id, kickoff, { n: FORM_N }).results.reverse();
			return { id, name, form, tablePosition: position(id) };
		};
		out.set(f.id, {
			fixtureId: f.id,
			league: { id: f.l, name: f.ln },
			kickoff,
			home: team(f.h, f.hn),
			away: team(f.a, f.an),
			odds1x2: odds.odds1x2!,
			oddsOu25: odds.oddsOu25,
			tableSize: teamIds.length || undefined
		});
	}
	return out;
}

/** Determinisztikus index a seedből (mulberry32 egy lépése). */
export const seededIndex = (seed: number, n: number): number => {
	let t = (seed + 0x6d2b79f5) | 0;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) % n;
};

/** Saját fogadás → kvíz-tipp (1X2 és O/U 2,5); más piac `null`. */
export const placedBetPick = (marketId: number, selection: string, line: number | null): QuizPick | null => {
	if (marketId === 1 && line === null) return ({ Home: '1', Draw: 'X', Away: '2' } as const)[selection as 'Home'] ?? null;
	if (marketId === 5 && line === 2.5) return ({ Over: 'over', Under: 'under' } as const)[selection as 'Over'] ?? null;
	return null;
};

export function createQuizService(
	db: SqlExecutor,
	opts: { answers?: OwnerAnswerRepository; random?: () => number } = {}
): QuizService {
	const answers = opts.answers ?? new SqlOwnerAnswerRepository(db);
	const random = opts.random ?? Math.random;
	return {
		async next(seed) {
			// TODO(polish): sok jelöltnél SQL-oldali mintavétel (most az összes id betöltődik).
			const { rows } = await db.query<{ id: number }>(
				`SELECT f.id::float8 AS id FROM fixture f
				 WHERE f.status = ANY($1::text[]) AND f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
					AND NOT EXISTS (SELECT 1 FROM owner_answer a WHERE a.fixture_id = f.id)
					AND EXISTS (SELECT 1 FROM odds_snapshot s JOIN odds_quote q ON q.snapshot_id = s.id
						WHERE s.fixture_id = f.id AND q.market_id = 1 AND q.line IS NULL)
				 ORDER BY f.id`,
				[FINISHED]
			);
			const n = rows.length;
			if (!n) return null;
			const start = seed === null ? Math.floor(random() * n) : seededIndex(seed, n);
			// Kötegelten a kezdőindextől; az első használható jelölt marad a válasz (kimenet változatlan).
			for (let i = 0; i < n; i += NEXT_BATCH) {
				const ids = Array.from({ length: Math.min(NEXT_BATCH, n - i) }, (_, j) => rows[(start + i + j) % n].id);
				const qs = await loadQuizQuestions(db, ids);
				const hit = ids.find((id) => qs.has(id));
				if (hit !== undefined) return qs.get(hit)!;
			}
			return null;
		},

		async answer(body) {
			const input = parseQuizAnswer(body);
			const result = await loadResult(db, input.fixtureId);
			if (!result) throw new QuizValidationError(`Nincs ilyen lejátszott meccs: ${input.fixtureId}`);
			const saved = await answers.upsert(input);
			return { answer: saved, result, correct: isCorrect(saved.pick, result) };
		},

		async profile() {
			const samples: ProfileSample[] = [];
			let ignored = 0;
			const quiz = await answers.list();
			const answered = new Set(quiz.map((a) => a.fixtureId));
			const { rows: bets } = await db.query<{ fx: number; m: number; s: string; line: number | null }>(
				`SELECT DISTINCT ON (fixture_id) fixture_id::float8 AS fx, market_id::float8 AS m, selection AS s, line::float8 AS line
				 FROM placed_bet ORDER BY fixture_id, placed_at, id`
			);
			// Egy köteg: a megválaszolt + a leképezhető saját fogadások meccsei (Q3b).
			const betIds = bets.filter((b) => !answered.has(b.fx) && placedBetPick(b.m, b.s, b.line)).map((b) => b.fx);
			const questions = await loadQuizQuestions(db, [...answered, ...betIds]);
			for (const a of quiz) {
				const question = questions.get(a.fixtureId);
				if (question) samples.push({ question, answer: { fixtureId: a.fixtureId, pick: a.pick, confidence: a.confidence } });
				else ignored++;
			}
			const quizCount = samples.length;
			for (const b of bets) {
				if (answered.has(b.fx)) continue;
				const pick = placedBetPick(b.m, b.s, b.line);
				const question = pick && questions.get(b.fx);
				if (pick && question && (pick === '1' || pick === 'X' || pick === '2' || question.oddsOu25))
					samples.push({ question, answer: { fixtureId: b.fx, pick } });
				else ignored++;
			}
			return {
				profile: buildOwnerProfile(samples),
				crossValidation: crossValidateProfile(samples),
				sources: { quiz: quizCount, placedBets: samples.length - quizCount, ignored }
			};
		}
	};
}
