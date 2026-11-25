-- 0006 – Ütemező-napló (ROADMAP 1.7, architecture.md §7.1). Minden tick egy sor; a foglalt advisory lock miatt
-- kihagyott tick is ('locked'), így a „~96 tick / 24 óra, nincs átfedés” ellenőrizhető.
CREATE TABLE IF NOT EXISTS cron_run (
	id bigserial PRIMARY KEY,
	started_at timestamptz NOT NULL DEFAULT now(),
	finished_at timestamptz,
	status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'locked', 'error')),
	planned integer NOT NULL DEFAULT 0 CHECK (planned >= 0),
	executed integer NOT NULL DEFAULT 0 CHECK (executed >= 0),
	calls integer NOT NULL DEFAULT 0 CHECK (calls >= 0),
	error text,
	duration_ms integer
);
CREATE INDEX IF NOT EXISTS cron_run_started_at_idx ON cron_run (started_at);
