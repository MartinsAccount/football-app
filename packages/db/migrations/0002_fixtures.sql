-- 0002 – Meccsek, tabella, sérültek (architecture.md §10.2).
CREATE TABLE IF NOT EXISTS fixture (
	id bigint PRIMARY KEY,
	league_id bigint NOT NULL REFERENCES league (id),
	season integer NOT NULL,
	round text,
	kickoff_at timestamptz NOT NULL,
	status text NOT NULL,
	home_team_id bigint NOT NULL REFERENCES team (id),
	away_team_id bigint NOT NULL REFERENCES team (id),
	goals_home smallint,
	goals_away smallint,
	ht_home smallint,
	ht_away smallint,
	ft_home smallint,
	ft_away smallint,
	et_home smallint,
	et_away smallint,
	pen_home smallint,
	pen_away smallint,
	venue_id bigint,
	referee text,
	updated_at timestamptz NOT NULL DEFAULT now(),
	CHECK (home_team_id <> away_team_id)
);
CREATE INDEX IF NOT EXISTS fixture_league_season_kickoff_idx ON fixture (league_id, season, kickoff_at);
CREATE INDEX IF NOT EXISTS fixture_status_kickoff_idx ON fixture (status, kickoff_at);
CREATE INDEX IF NOT EXISTS fixture_home_team_idx ON fixture (home_team_id);
CREATE INDEX IF NOT EXISTS fixture_away_team_idx ON fixture (away_team_id);

CREATE TABLE IF NOT EXISTS fixture_team_stats (
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	team_id bigint NOT NULL REFERENCES team (id),
	shots_total smallint,
	shots_on smallint,
	corners smallint,
	possession numeric(5, 2),
	fouls smallint,
	yellow smallint,
	red smallint,
	saves smallint,
	passes_pct numeric(5, 2),
	raw jsonb,
	PRIMARY KEY (fixture_id, team_id)
);

-- v1: csak gólok és piros lapok.
CREATE TABLE IF NOT EXISTS fixture_event (
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	seq integer NOT NULL,
	minute smallint,
	extra smallint,
	team_id bigint REFERENCES team (id),
	player_id bigint,
	type text NOT NULL,
	detail text,
	PRIMARY KEY (fixture_id, seq)
);

-- Az API csak az aktuális tabellát adja → pillanatképek (a pont-idejű tabellát a meccsekből számoljuk).
CREATE TABLE IF NOT EXISTS standing_snapshot (
	league_id bigint NOT NULL,
	season integer NOT NULL,
	captured_at timestamptz NOT NULL,
	team_id bigint NOT NULL REFERENCES team (id),
	rank smallint NOT NULL,
	points smallint NOT NULL,
	played smallint NOT NULL,
	win smallint NOT NULL,
	draw smallint NOT NULL,
	lose smallint NOT NULL,
	gf smallint NOT NULL,
	ga smallint NOT NULL,
	form text,
	description text,
	group_name text,
	PRIMARY KEY (league_id, season, captured_at, team_id),
	FOREIGN KEY (league_id, season) REFERENCES season (league_id, year)
);

CREATE TABLE IF NOT EXISTS injury_report (
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	player_id bigint NOT NULL,
	captured_at timestamptz NOT NULL,
	team_id bigint NOT NULL REFERENCES team (id),
	player_name text,
	type text,
	reason text,
	PRIMARY KEY (fixture_id, player_id, captured_at)
);
