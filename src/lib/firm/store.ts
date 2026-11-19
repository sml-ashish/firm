import "server-only";

import * as fs from "node:fs/promises";
import path from "node:path";

import { buildFixtures } from "./fixtures";
import type { Crane, Cycle } from "./types";

export interface FirmState {
  cycles: Cycle[];
  cranes: Crane[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "firm-workflow.json");
const TMP_FILE = path.join(DATA_DIR, "firm-workflow.json.tmp");

/** Parsed JSON kept in memory after the first successful read. */
let cache: FirmState | null = null;

/** Module-level chain: every read/mutation is queued behind the previous one. */
let chain: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function clone(state: FirmState): FirmState {
  return structuredClone(state);
}

async function writeFileAtomic(state: FirmState): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TMP_FILE, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(TMP_FILE, DATA_FILE);
}

async function load(): Promise<FirmState> {
  if (cache) return cache;

  let state: FirmState;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as FirmState;
    if (!parsed || !Array.isArray(parsed.cycles) || !Array.isArray(parsed.cranes)) {
      throw new Error("Invalid FIRM state file");
    }
    state = parsed;
  } catch {
    // Missing or corrupt file — reseed from the deterministic fixtures.
    state = buildFixtures();
    await writeFileAtomic(state);
  }

  cache = state;
  return state;
}

export async function getState(): Promise<FirmState> {
  return enqueue(async () => clone(await load()));
}

export async function mutate(
  fn: (state: FirmState) => void | Promise<void>,
): Promise<void> {
  return enqueue(async () => {
    const current = await load();
    const draft = clone(current);
    await fn(draft);
    await writeFileAtomic(draft);
    cache = draft;
  });
}

export async function resetState(): Promise<void> {
  return enqueue(async () => {
    const fresh = buildFixtures();
    await writeFileAtomic(fresh);
    cache = fresh;
  });
}
