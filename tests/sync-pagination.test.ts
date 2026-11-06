import test from "node:test";
import assert from "node:assert/strict";
import { syncIncrementalPass } from "../lib/sync-pagination.ts";

test("incremental sync processes more than 10,000 changes across bounded passes", async () => {
  const saved = new Set<number>();
  let durable: string | null = null;
  let complete = false;
  let passes = 0;
  while (!complete) {
    const result = await syncIncrementalPass<number>(
      durable,
      async current => {
        const page = Number(current ?? 0);
        return {
          added: Array.from({ length: 100 }, (_, i) => page * 100 + i),
          modified: [],
          removed: [],
          next_cursor: String(page + 1),
          has_more: page < 119,
        };
      },
      async page => { for (const row of page.added) saved.add(row); },
      async next => { durable = next; },
      10,
    );
    complete = result.complete;
    passes++;
  }
  assert.equal(saved.size, 12000);
  assert.equal(durable, "120");
  assert.equal(passes, 12);
});

test("a failed later page resumes from its checkpoint without duplicates", async () => {
  let durableCursor: string | null = null;
  const saved: number[] = [];
  let fail = true;
  const fetchPage = async (current: string | null) => {
    const page = Number(current ?? 0);
    if (page === 2 && fail) throw new Error("provider interruption");
    return { added: [page], modified: [], removed: [], next_cursor: String(page + 1), has_more: page < 2 };
  };
  const apply = async (page: { added: number[] }) => { saved.push(page.added[0]); };
  await assert.rejects(syncIncrementalPass(durableCursor, fetchPage, apply, async next => { durableCursor = next; }));
  assert.equal(durableCursor, "2");
  fail = false;
  const result = await syncIncrementalPass(durableCursor, fetchPage, apply, async next => { durableCursor = next; });
  assert.equal(result.complete, true);
  assert.equal(durableCursor, "3");
  assert.deepEqual(saved, [0, 1, 2]);
});

test("a cursor that stops advancing is an error, not an endless loop", async () => {
  await assert.rejects(
    syncIncrementalPass(null,
      async () => ({ added: [], modified: [], removed: [], next_cursor: "stuck", has_more: true }),
      async () => {}, async () => {}),
    /did not advance/,
  );
});

test("maxPages must be a positive integer", async () => {
  await assert.rejects(syncIncrementalPass(null, async () => { throw new Error("unused"); }, async () => {}, async () => {}, 0), /positive/);
});
