-- 0007 – Pont-idejű, a meccsekből számolt tabella (ROADMAP 4.3, architecture.md §10.2). Additív; a sorok bármikor
-- újraszámolhatók a `fixture` táblából (upsert), ezért nem pillanatkép. `as_of`: a tabella az ez előtt kezdődött,
-- befejezett meccsekből áll.
CREATE TABLE IF NOT EXISTS standing_derived (
	league_id bigint NOT NULL,
	season integer NOT NULL,
	as_of timestamptz NOT NULL,
	team_id bigint NOT NULL REFERENCES team (id),
	rank smallint NOT NULL,
	points smallint NOT NULL,
	played smallint NOT NULL,
	win smallint NOT NULL,
	draw smallint NOT NULL,
	lose smallint NOT NULL,
	gf smallint NOT NULL,
	ga smallint NOT NULL,
	computed_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (league_id, season, as_of, team_id),
	FOREIGN KEY (league_id, season) REFERENCES season (league_id, year)
);
