-- 0001 – Törzsadat (architecture.md §10.1). Standard Postgres (>= 15), idempotens.
CREATE TABLE IF NOT EXISTS league (
	id bigint PRIMARY KEY,
	name text NOT NULL,
	country text,
	type text CHECK (type IN ('league', 'cup')),
	logo_url text
);

CREATE TABLE IF NOT EXISTS season (
	league_id bigint NOT NULL REFERENCES league (id),
	year integer NOT NULL,
	start_date date,
	end_date date,
	is_current boolean NOT NULL DEFAULT false,
	coverage jsonb,
	coverage_checked_at timestamptz,
	PRIMARY KEY (league_id, year)
);

CREATE TABLE IF NOT EXISTS team (
	id bigint PRIMARY KEY,
	name text NOT NULL,
	code text,
	country text,
	logo_url text
);

-- Más források (football-data.co.uk CSV, legacy JSON) csapatneveinek leképezése.
CREATE TABLE IF NOT EXISTS team_alias (
	source text NOT NULL,
	name text NOT NULL,
	team_id bigint NOT NULL REFERENCES team (id),
	PRIMARY KEY (source, name)
);

CREATE TABLE IF NOT EXISTS season_team (
	league_id bigint NOT NULL,
	year integer NOT NULL,
	team_id bigint NOT NULL REFERENCES team (id),
	PRIMARY KEY (league_id, year, team_id),
	FOREIGN KEY (league_id, year) REFERENCES season (league_id, year)
);

CREATE TABLE IF NOT EXISTS bookmaker (
	id bigint PRIMARY KEY,
	name text NOT NULL,
	stored boolean NOT NULL DEFAULT false
);

-- id = API bet id; code = a piac magyar domain-neve (pl. 'Vegeredmeny', BetTypes.ts).
CREATE TABLE IF NOT EXISTS market (
	id bigint PRIMARY KEY,
	name text NOT NULL,
	code text UNIQUE,
	analyzed boolean NOT NULL DEFAULT false,
	stored boolean NOT NULL DEFAULT false
);
