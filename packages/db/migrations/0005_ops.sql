-- 0005 – Beállítások és üzem (architecture.md §10.5, §7.2).
CREATE TABLE IF NOT EXISTS followed_league (
	league_id bigint PRIMARY KEY REFERENCES league (id),
	enabled boolean NOT NULL DEFAULT true,
	priority smallint NOT NULL DEFAULT 0,
	markets text[], -- NULL = a globális market.stored
	added_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_filter (
	team_id bigint PRIMARY KEY REFERENCES team (id),
	mode text NOT NULL CHECK (mode IN ('include', 'exclude'))
);

CREATE TABLE IF NOT EXISTS setting (
	key text PRIMARY KEY,
	value jsonb NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_task (
	id bigserial PRIMARY KEY,
	dedupe_key text NOT NULL UNIQUE,
	kind text NOT NULL,
	params jsonb NOT NULL DEFAULT '{}'::jsonb,
	priority smallint NOT NULL DEFAULT 0,
	status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'skipped')),
	attempts smallint NOT NULL DEFAULT 0,
	not_before timestamptz NOT NULL DEFAULT now(),
	deadline timestamptz,
	last_error text,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingest_task_queue_idx ON ingest_task (status, not_before, priority);

-- Napi hívás-budget (UTC-nap). Free tier: 100 hívás/nap; a CHECK-ek miatt a számláló
-- adatbázis-szinten sem lépheti túl.
CREATE TABLE IF NOT EXISTS api_budget_day (
	day date PRIMARY KEY,
	used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
	daily_limit integer NOT NULL DEFAULT 100 CHECK (daily_limit BETWEEN 0 AND 100),
	reserve integer NOT NULL DEFAULT 0 CHECK (reserve >= 0),
	synced_remaining integer,
	CHECK (used <= daily_limit)
);

-- Atomikus foglalás a hívás ELŐTT. p_cap: opcionális alacsonyabb plafon (pl. backfill: 70).
-- Az új used értéket adja vissza, vagy NULL-t, ha nincs keret (ilyenkor nincs hívás).
CREATE OR REPLACE FUNCTION api_budget_reserve(p_day date, p_cap integer DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql AS $fn$
DECLARE
	v_used integer;
BEGIN
	INSERT INTO api_budget_day (day) VALUES (p_day) ON CONFLICT (day) DO NOTHING;
	UPDATE api_budget_day
		SET used = used + 1,
			synced_remaining = synced_remaining - 1
		WHERE day = p_day
			AND used < daily_limit - reserve
			AND (p_cap IS NULL OR used < p_cap)
			AND (synced_remaining IS NULL OR synced_remaining > 0)
		RETURNING used INTO v_used;
	RETURN v_used;
END;
$fn$;

CREATE TABLE IF NOT EXISTS api_call_log (
	id bigserial PRIMARY KEY,
	called_at timestamptz NOT NULL DEFAULT now(),
	endpoint text NOT NULL,
	params jsonb NOT NULL DEFAULT '{}'::jsonb,
	http_status smallint,
	errors jsonb,
	results integer,
	paging_total integer,
	quota_remaining_day integer,
	rate_remaining_min integer,
	duration_ms integer,
	task_id bigint REFERENCES ingest_task (id) ON DELETE SET NULL,
	mock boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS api_call_log_called_at_idx ON api_call_log (called_at);

-- Opcionális nyers válasz, legfeljebb 14 napig (a karbantartó job törli).
CREATE TABLE IF NOT EXISTS api_raw_response (
	call_id bigint PRIMARY KEY REFERENCES api_call_log (id) ON DELETE CASCADE,
	body jsonb NOT NULL,
	stored_at timestamptz NOT NULL DEFAULT now()
);

-- Alapbeállítások (DESIGN §9: EV-küszöb 5%). Meglévő értéket nem ír felül.
INSERT INTO setting (key, value) VALUES
	('ev_threshold', '0.05'::jsonb),
	('min_odds', '1.3'::jsonb),
	('max_odds', '5'::jsonb),
	('stake_mode', '"flat"'::jsonb),
	('unit_ft', '1000'::jsonb),
	('backfill_cap', '70'::jsonb),
	('odds_retention', 'true'::jsonb),
	('active_model_version', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
