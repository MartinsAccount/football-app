-- 0003 – Odds (architecture.md §10.3, §4.1). A snapshotok csak beszúrással íródnak;
-- a köztes snapshotokat a megőrzési job törölheti, ezért itt nincs append-only trigger.
CREATE TABLE IF NOT EXISTS odds_snapshot (
	id bigserial PRIMARY KEY,
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	captured_at timestamptz NOT NULL,
	provider_updated_at timestamptz,
	source text NOT NULL CHECK (source IN ('api-football', 'football-data-csv', 'legacy-json', 'manual')),
	kind text NOT NULL CHECK (kind IN ('early', 'late', 'adhoc', 'opening_csv', 'closing_csv', 'legacy')),
	UNIQUE (fixture_id, captured_at, source)
);

-- Csak a stored piacok × stored irodák. line: pl. 2.5 (O/U), NULL, ha a piacnak nincs vonala.
CREATE TABLE IF NOT EXISTS odds_quote (
	id bigserial PRIMARY KEY,
	snapshot_id bigint NOT NULL REFERENCES odds_snapshot (id) ON DELETE CASCADE,
	bookmaker_id bigint NOT NULL REFERENCES bookmaker (id),
	market_id bigint NOT NULL REFERENCES market (id),
	selection text NOT NULL,
	line numeric(5, 2),
	odd numeric(7, 3) NOT NULL CHECK (odd > 1),
	UNIQUE NULLS NOT DISTINCT (snapshot_id, bookmaker_id, market_id, selection, line)
);

-- A teljes lekért válaszból (iroda-szűrés előtt) számolt legjobb és átlag odds.
CREATE TABLE IF NOT EXISTS odds_best (
	id bigserial PRIMARY KEY,
	snapshot_id bigint NOT NULL REFERENCES odds_snapshot (id) ON DELETE CASCADE,
	market_id bigint NOT NULL REFERENCES market (id),
	selection text NOT NULL,
	line numeric(5, 2),
	max_odd numeric(7, 3) NOT NULL,
	bookmaker_id bigint REFERENCES bookmaker (id),
	avg_odd numeric(7, 3),
	n_books smallint NOT NULL,
	UNIQUE NULLS NOT DISTINCT (snapshot_id, market_id, selection, line)
);
