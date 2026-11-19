import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("PREPARER"),
  designation: text("designation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  evaluationDate: date("evaluation_date").notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("PROCESSED"),
  summary: jsonb("summary").notNull().default({}),
  errors: jsonb("errors").notNull().default([]),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetCode: text("asset_code").notNull().unique(),
  description: text("description"),
  oem: text("oem"),
  model: text("model").notNull(),
  category: text("category"),
  capacityMt: numeric("capacity_mt", { precision: 10, scale: 2 }),
  yom: integer("yom").notNull(),
  capitalisationDate: date("capitalisation_date"),
  originalCapex: numeric("original_capex", { precision: 16, scale: 2 }),
  grossBlock: numeric("gross_block", { precision: 16, scale: 2 }),
  netBookValue: numeric("net_book_value", { precision: 16, scale: 2 }),
  replacementCapex: numeric("replacement_capex", { precision: 16, scale: 2 }),
  location: text("location"),
  region: text("region"),
  currentStatus: text("current_status"),
  oemSupport: text("oem_support").default("unknown"),
  sparesAvailability: text("spares_availability").default("unknown"),
  complianceStatus: text("compliance_status").default("unknown"),
  repairQuote: numeric("repair_quote", { precision: 16, scale: 2 }),
  certFitnessExpiry: date("cert_fitness_expiry"),
  certLiftingExpiry: date("cert_lifting_expiry"),
  certTpiExpiry: date("cert_tpi_expiry"),
  certPesoExpiry: date("cert_peso_expiry"),
  notes: text("notes"),
  uploadId: integer("upload_id").references(() => uploads.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const performance = pgTable(
  "performance",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    fy: text("fy").notNull(),
    availableDays: integer("available_days"),
    deployedDays: integer("deployed_days"),
    rentalRevenue: numeric("rental_revenue", { precision: 16, scale: 2 }),
    operatingCost: numeric("operating_cost", { precision: 16, scale: 2 }),
    capitalEmployed: numeric("capital_employed", { precision: 16, scale: 2 }),
  },
  (table) => [uniqueIndex("performance_asset_fy_idx").on(table.assetId, table.fy)],
);

export const retention = pgTable(
  "retention",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    evaluationDate: date("evaluation_date").notNull(),
    rentabilityCommittable: boolean("rentability_committable"),
    npv5yr: numeric("npv_5yr", { precision: 16, scale: 2 }),
    salePrice: numeric("sale_price", { precision: 16, scale: 2 }),
    capitalReleaseReturnPct: numeric("capital_release_return_pct", { precision: 8, scale: 2 }),
    craneReturnPct: numeric("crane_return_pct", { precision: 8, scale: 2 }),
    recommendation: text("recommendation"),
    justification: text("justification"),
  },
  (table) => [
    uniqueIndex("retention_asset_date_idx").on(table.assetId, table.evaluationDate),
  ],
);

export const evaluationRuns = pgTable("evaluation_runs", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id").references(() => uploads.id),
  evaluationDate: date("evaluation_date").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("PENDING"),
  summary: jsonb("summary").notNull().default({}),
  policy: jsonb("policy").notNull().default({}),
});

export const evaluationResults = pgTable("evaluation_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => evaluationRuns.id, { onDelete: "cascade" }),
  assetId: integer("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  assetCode: text("asset_code").notNull(),
  oldFleet: boolean("old_fleet").notNull().default(false),
  nonDeployable: boolean("non_deployable").notNull().default(false),
  nrg: boolean("nrg").notNull().default(false),
  nrgStatus: text("nrg_status").notNull().default("insufficient"),
  ageYears: integer("age_years"),
  ageThreshold: integer("age_threshold"),
  primaryClass: text("primary_class").notNull().default("HEALTHY"),
  reasons: jsonb("reasons").notNull().default([]),
  metrics: jsonb("metrics").notNull().default({}),
});

export const approvals = pgTable("approvals", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => evaluationRuns.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(),
  actorId: integer("actor_id").references(() => users.id),
  actorName: text("actor_name"),
  designation: text("designation"),
  action: text("action").notNull(),
  comment: text("comment"),
  actedAt: timestamp("acted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id),
  actorName: text("actor_name"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type PerformanceRow = typeof performance.$inferSelect;
export type RetentionRow = typeof retention.$inferSelect;
export type EvaluationRun = typeof evaluationRuns.$inferSelect;
export type EvaluationResult = typeof evaluationResults.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
