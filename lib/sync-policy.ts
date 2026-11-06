// Background sync on a free plan: which connection should this cron run sync?
//
// The app runs on Cloudflare's free Workers plan, which allows roughly 10 ms of
// CPU per invocation. Instead of syncing every institution in one large job, an
// hourly cron does one small, bounded step:
// - Resume an unfinished bank sync first, so a long history finishes over
//   several runs instead of restarting.
// - Otherwise pick the stalest connection that has not synced in FRESH_FOR_MS
//   (never-synced connections first).
// - Skip connections locked by a sync that is already running.
// Each run fetches at most CRON_PAGES_PER_RUN transaction pages. This policy is
// pure and unit-tested; the cron handler only does the I/O.

export const FRESH_FOR_MS = 20 * 60 * 60 * 1000;
export const CRON_PAGES_PER_RUN = 3;

export type Candidate = {
  id: string;
  institution: string;
  last_sync: string | null;
  sync_in_progress: boolean;
  lock_until: number;
};

/** Resume an unfinished bank sync first; otherwise the stalest connection older than FRESH_FOR_MS. */
export function pickConnection(rows: Candidate[], now: number): Candidate | null {
  const unlocked = rows.filter(row => row.lock_until < now);
  const backlog = unlocked.find(row => row.sync_in_progress);
  if (backlog) return backlog;
  const stale = unlocked
    .filter(row => !row.last_sync || now - Date.parse(row.last_sync) >= FRESH_FOR_MS)
    .sort((a, b) => (a.last_sync ? Date.parse(a.last_sync) : 0) - (b.last_sync ? Date.parse(b.last_sync) : 0));
  return stale[0] ?? null;
}
