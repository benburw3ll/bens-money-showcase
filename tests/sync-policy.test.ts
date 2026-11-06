import test from "node:test";
import assert from "node:assert/strict";
import { FRESH_FOR_MS, pickConnection, type Candidate } from "../lib/sync-policy.ts";

const now = Date.parse("2026-11-04T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const row = (id: string, more: Partial<Candidate> = {}): Candidate => ({
  id, institution: id, last_sync: ago(FRESH_FOR_MS + 1), sync_in_progress: false, lock_until: 0, ...more,
});

test("resumes an unfinished bank sync before anything else", () => {
  const picked = pickConnection([
    row("stale", { last_sync: null }),
    row("backlog", { sync_in_progress: true, last_sync: ago(1000) }),
  ], now);
  assert.equal(picked?.id, "backlog");
});

test("picks the stalest connection, never-synced first", () => {
  assert.equal(pickConnection([row("older", { last_sync: ago(FRESH_FOR_MS * 3) }), row("never", { last_sync: null }), row("old")], now)?.id, "never");
  assert.equal(pickConnection([row("old"), row("older", { last_sync: ago(FRESH_FOR_MS * 3) })], now)?.id, "older");
});

test("skips fresh and locked connections", () => {
  assert.equal(pickConnection([row("fresh", { last_sync: ago(60_000) })], now), null);
  assert.equal(pickConnection([row("locked", { lock_until: now + 1000, sync_in_progress: true })], now), null);
  assert.equal(pickConnection([], now), null);
});

test("an expired lock no longer blocks a resume", () => {
  assert.equal(pickConnection([row("was-locked", { lock_until: now - 1, sync_in_progress: true })], now)?.id, "was-locked");
});
