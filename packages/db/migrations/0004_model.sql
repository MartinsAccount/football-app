-- 0004 – Modell, predikció, kiértékelés (architecture.md §10.4).
CREATE TABLE IF NOT EXISTS model_version (
	id text PRIMARY KEY, -- pl. 'elo-poisson@0.1.0'
	created_at timestamptz NOT NULL DEFAULT now(),
	description text,
	params jsonb,
	git_sha text,
	status text NOT NULL DEFAULT 'dev' CHECK (status IN ('dev', 'shadow', 'live', 'retired'))
);

CREATE TABLE IF NOT EXISTS prediction_run (
	id bigserial PRIMARY KEY,
	model_version text NOT NULL REFERENCES model_version (id),
	started_at timestamptz NOT NULL DEFAULT now(),
	trigger text NOT NULL CHECK (trigger IN ('schedule', 'manual', 'backtest')),
	as_of timestamptz -- backtestnél a szimulált idő
);

-- Append-only: utólag nem módosítható és nem törölhető (triggerek lent).
CREATE TABLE IF NOT EXISTS prediction (
	id bigserial PRIMARY KEY,
	run_id bigint NOT NULL REFERENCES prediction_run (id),
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	market_id bigint NOT NULL REFERENCES market (id),
	selection text NOT NULL,
	line numeric(5, 2),
	p_model double precision NOT NULL CHECK (p_model >= 0 AND p_model <= 1),
	p_market_fair double precision CHECK (p_market_fair >= 0 AND p_market_fair <= 1),
	odds_snapshot_id bigint REFERENCES odds_snapshot (id) ON DELETE SET NULL,
	best_odd numeric(7, 3),
	best_bookmaker_id bigint REFERENCES bookmaker (id),
	min_acceptable_odd numeric(7, 3),
	ev double precision,
	is_recommendation boolean NOT NULL DEFAULT false,
	stake_units numeric(6, 2),
	confidence text,
	features jsonb NOT NULL DEFAULT '{}'::jsonb,
	explanation jsonb NOT NULL DEFAULT '[]'::jsonb,
	warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE NULLS NOT DISTINCT (run_id, fixture_id, market_id, selection, line)
);
CREATE INDEX IF NOT EXISTS prediction_fixture_idx ON prediction (fixture_id);

CREATE OR REPLACE FUNCTION prediction_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
	RAISE EXCEPTION 'prediction is append-only (DELETE not allowed)';
END;
$fn$;

-- Egy snapshot törlése (ON DELETE SET NULL) UPDATE-et vált ki: csak ezt az egy
-- oszlop-nullázást engedjük, minden más módosítás tilos.
CREATE OR REPLACE FUNCTION prediction_guard_update() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
	IF NEW.odds_snapshot_id IS NULL AND OLD.odds_snapshot_id IS NOT NULL
		AND (to_jsonb(NEW) - 'odds_snapshot_id') = (to_jsonb(OLD) - 'odds_snapshot_id') THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'prediction is append-only (UPDATE not allowed)';
END;
$fn$;

DROP TRIGGER IF EXISTS prediction_no_update ON prediction;
CREATE TRIGGER prediction_no_update BEFORE UPDATE ON prediction
	FOR EACH ROW EXECUTE FUNCTION prediction_guard_update();
DROP TRIGGER IF EXISTS prediction_no_delete ON prediction;
CREATE TRIGGER prediction_no_delete BEFORE DELETE ON prediction
	FOR EACH ROW EXECUTE FUNCTION prediction_no_delete();

-- Külön tábla, így a predikció változatlan marad.
CREATE TABLE IF NOT EXISTS evaluation (
	prediction_id bigint PRIMARY KEY REFERENCES prediction (id),
	settled_at timestamptz NOT NULL,
	outcome text NOT NULL CHECK (outcome IN ('win', 'loss', 'void', 'half_win', 'half_loss')),
	profit_units double precision NOT NULL,
	brier double precision,
	log_loss double precision,
	closing_snapshot_id bigint REFERENCES odds_snapshot (id) ON DELETE SET NULL,
	closing_odd numeric(7, 3),
	clv double precision
);

-- A tulajdonos ténylegesen megtett tippjei (kézi rögzítés; automatikus leadás nincs, PRD 8).
CREATE TABLE IF NOT EXISTS placed_bet (
	id bigserial PRIMARY KEY,
	prediction_id bigint REFERENCES prediction (id),
	fixture_id bigint NOT NULL REFERENCES fixture (id),
	market_id bigint NOT NULL REFERENCES market (id),
	selection text NOT NULL,
	line numeric(5, 2),
	bookmaker_label text,
	odd_taken numeric(7, 3) NOT NULL CHECK (odd_taken > 1),
	stake numeric(12, 2) NOT NULL CHECK (stake > 0),
	placed_at timestamptz NOT NULL DEFAULT now(),
	note text
);
