/**
 * Idempotent schema. Kept as raw SQL so the same DDL runs against both the
 * embedded PGlite database (local development) and PostgreSQL (production).
 */
export const DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PREPARER',
  designation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  evaluation_date DATE NOT NULL,
  uploaded_by INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PROCESSED',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY,
  asset_code TEXT NOT NULL UNIQUE,
  description TEXT,
  oem TEXT,
  model TEXT NOT NULL,
  category TEXT,
  capacity_mt NUMERIC(10,2),
  yom INTEGER NOT NULL,
  capitalisation_date DATE,
  original_capex NUMERIC(16,2),
  gross_block NUMERIC(16,2),
  net_book_value NUMERIC(16,2),
  replacement_capex NUMERIC(16,2),
  location TEXT,
  region TEXT,
  current_status TEXT,
  oem_support TEXT DEFAULT 'unknown',
  spares_availability TEXT DEFAULT 'unknown',
  compliance_status TEXT DEFAULT 'unknown',
  repair_quote NUMERIC(16,2),
  cert_fitness_expiry DATE,
  cert_lifting_expiry DATE,
  cert_tpi_expiry DATE,
  cert_peso_expiry DATE,
  notes TEXT,
  upload_id INTEGER REFERENCES uploads(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  fy TEXT NOT NULL,
  available_days INTEGER,
  deployed_days INTEGER,
  rental_revenue NUMERIC(16,2),
  operating_cost NUMERIC(16,2),
  capital_employed NUMERIC(16,2)
);
CREATE UNIQUE INDEX IF NOT EXISTS performance_asset_fy_idx ON performance(asset_id, fy);

CREATE TABLE IF NOT EXISTS retention (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  evaluation_date DATE NOT NULL,
  rentability_committable BOOLEAN,
  npv_5yr NUMERIC(16,2),
  sale_price NUMERIC(16,2),
  capital_release_return_pct NUMERIC(8,2),
  crane_return_pct NUMERIC(8,2),
  recommendation TEXT,
  justification TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS retention_asset_date_idx ON retention(asset_id, evaluation_date);

CREATE TABLE IF NOT EXISTS evaluation_runs (
  id SERIAL PRIMARY KEY,
  upload_id INTEGER REFERENCES uploads(id),
  evaluation_date DATE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PENDING',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS evaluation_results (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  old_fleet BOOLEAN NOT NULL DEFAULT false,
  non_deployable BOOLEAN NOT NULL DEFAULT false,
  nrg BOOLEAN NOT NULL DEFAULT false,
  nrg_status TEXT NOT NULL DEFAULT 'insufficient',
  age_years INTEGER,
  age_threshold INTEGER,
  primary_class TEXT NOT NULL DEFAULT 'HEALTHY',
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS evaluation_results_run_idx ON evaluation_results(run_id);
CREATE INDEX IF NOT EXISTS evaluation_results_asset_idx ON evaluation_results(asset_id);

CREATE TABLE IF NOT EXISTS approvals (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT,
  designation TEXT,
  action TEXT NOT NULL,
  comment TEXT,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approvals_run_idx ON approvals(run_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  actor_name TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
