// Resumable, idempotent transaction sync.
//
// Bank transaction feeds arrive as cursor-paginated pages of added, modified,
// and removed rows. A long history can take many pages, and a free-plan Worker
// cannot fetch them all in one invocation. So each pass:
// - applies a page idempotently (re-applying the same page changes nothing),
// - checkpoints the page's cursor right after it is saved,
// - stops after `maxPages`, reporting whether the feed is complete.
// If a page fails, the next pass resumes from the last checkpoint without
// duplicating rows. Callers keep the original cursor so they can restart a cycle
// if the provider reports that pages changed mid-pagination. A cursor that stops
// advancing is treated as an error instead of looping forever.

export type IncrementalPage<T> = {
  added: T[];
  modified: T[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
};

export async function syncIncrementalPass<T>(
  initialCursor: string | null,
  fetchPage: (cursor: string | null) => Promise<IncrementalPage<T>>,
  applyPage: (page: IncrementalPage<T>) => Promise<void>,
  checkpoint: (cursor: string, complete: boolean) => Promise<void>,
  maxPages = 10,
) {
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new Error("maxPages must be positive.");
  let cursor = initialCursor;
  const seen = new Set<string>();
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
    const page = await fetchPage(cursor);
    if (!page || typeof page.next_cursor !== "string" || typeof page.has_more !== "boolean") {
      throw new Error("Invalid incremental page.");
    }
    await applyPage(page);
    cursor = page.next_cursor;
    await checkpoint(cursor, !page.has_more);
    if (!page.has_more) return { cursor, complete: true, pages: pageNumber + 1 };
    if (seen.has(cursor)) throw new Error("Incremental cursor did not advance.");
    seen.add(cursor);
  }
  return { cursor: cursor!, complete: false, pages: maxPages };
}
