-- 0008 – Saját stílus (ROADMAP 12.2): a tulajdonos kvízválaszai lejátszott meccsekre. Additív; egy meccsre egy válasz
-- (újraválaszolás felülírja – upsert a `fixture_id`-n). `pick`: 1 | X | 2 | over | under | skip; `confidence` 1–3 vagy NULL.
CREATE TABLE IF NOT EXISTS owner_answer (
	fixture_id bigint PRIMARY KEY REFERENCES fixture (id),
	pick text NOT NULL CHECK (pick IN ('1', 'X', '2', 'over', 'under', 'skip')),
	confidence smallint CHECK (confidence BETWEEN 1 AND 3),
	answered_at timestamptz NOT NULL DEFAULT now()
);
