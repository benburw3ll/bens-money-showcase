import type { Account, Entry } from "./models.ts";

// Spending review: "where does my money keep going?"
//
// Design choices this module shows:
// - Only posted expenses count. Pending, voided, and transfer entries are
//   excluded so a review never mixes account transfers with spending.
// - Grouping uses the merchant label exactly as saved (case-insensitive), and
//   recurring services are matched by an explicit allow-list from the caller.
//   A store you visit every month is not called a subscription just because
//   the charges repeat.
// - Recurring services keep their full history (months seen, last charge) even
//   when the selected window is short, while period totals respect the window.
// - Institutions and merchant patterns are options. Nothing is hardcoded to a
//   particular bank or brand.

export type SpendingGroup = { name: string; amount: number; count: number; entries: Entry[] };

export type RecurringService = SpendingGroup & {
  periodAmount: number;
  periodCount: number;
  monthsSeen: number;
  lastDate: string;
};

export type SpendingWindow = "7d" | "14d" | "21d" | "1m" | "2m" | "3m" | "all";

export type SpendingReviewOptions = {
  /** Institutions whose accounts are reviewed. Omit to review every USD account. */
  institutions?: string[];
  /** Narrow the review to one of `institutions`. Default "all". */
  institution?: string;
  /** Inclusive YYYY-MM-DD bounds for the selected window. Null means open-ended. */
  start?: string | null;
  end?: string | null;
  /** Merchant labels treated as recurring services (an allow-list, not a guess). */
  recurringServices?: RegExp;
  /** Named merchant groups to surface on their own, e.g. { "Food delivery": /quick\s?eats/i }. */
  highlights?: Record<string, RegExp>;
  /** How many of the largest charges to return. Default 6. */
  largest?: number;
};

export type SpendingReview = {
  expenses: Entry[];
  firstDate: string | null;
  lastDate: string | null;
  total: number;
  merchants: SpendingGroup[];
  highlights: Record<string, { window: SpendingGroup; history: SpendingGroup }>;
  recurring: RecurringService[];
  largestCharges: Entry[];
};

/** First date of a rolling window that ends on (and includes) `today`. */
export function windowStart(window: SpendingWindow, today: string): string | null {
  if (window === "all") return null;
  const [year, month, day] = today.split("-").map(Number);
  if (window.endsWith("d")) {
    const start = new Date(Date.UTC(year, month - 1, day - Number(window.slice(0, -1)) + 1));
    return start.toISOString().slice(0, 10);
  }
  const target = new Date(Date.UTC(year, month - 1 - Number(window.slice(0, -1)), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function group(entries: Entry[]): SpendingGroup[] {
  const groups = new Map<string, SpendingGroup>();
  for (const entry of entries) {
    const name = entry.description.trim().replace(/\s+/g, " ") || "Unknown merchant";
    const key = name.toLocaleLowerCase("en-US");
    const item = groups.get(key) ?? { name, amount: 0, count: 0, entries: [] };
    item.amount += entry.amount;
    item.count += 1;
    item.entries.push(entry);
    groups.set(key, item);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

function combined(name: string, entries: Entry[]): SpendingGroup {
  return { name, amount: entries.reduce((sum, entry) => sum + entry.amount, 0), count: entries.length, entries };
}

export function reviewSpending(entries: Entry[], accounts: Account[], options: SpendingReviewOptions = {}): SpendingReview {
  const { institutions, institution = "all", start = null, end = null, largest = 6 } = options;
  const inWindow = (entry: Entry) => (start === null || entry.date >= start) && (end === null || entry.date <= end);

  const eligibleAccounts = new Set(accounts
    .filter(account => account.currency === "USD")
    .filter(account => !institutions || institutions.includes(account.institution))
    .filter(account => institution === "all" || account.institution === institution)
    .map(account => account.id));

  const allExpenses = entries.filter(entry =>
    entry.kind === "expense" && !entry.pending && !entry.voided &&
    entry.amount > 0 && entry.account_id !== null && eligibleAccounts.has(entry.account_id));
  const expenses = allExpenses.filter(inWindow);

  const recurringPattern = options.recurringServices;
  const recurring = recurringPattern
    ? group(allExpenses.filter(entry => recurringPattern.test(entry.description))).map(item => {
      const periodEntries = item.entries.filter(inWindow);
      return {
        ...item,
        periodAmount: periodEntries.reduce((sum, entry) => sum + entry.amount, 0),
        periodCount: periodEntries.length,
        monthsSeen: new Set(item.entries.map(entry => entry.date.slice(0, 7))).size,
        lastDate: item.entries.map(entry => entry.date).sort().at(-1)!,
      };
    }).sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.amount - a.amount)
    : [];

  const highlights: SpendingReview["highlights"] = {};
  for (const [name, pattern] of Object.entries(options.highlights ?? {})) {
    highlights[name] = {
      window: combined(name, expenses.filter(entry => pattern.test(entry.description))),
      history: combined(name, allExpenses.filter(entry => pattern.test(entry.description))),
    };
  }

  const dates = expenses.map(entry => entry.date).sort();
  return {
    expenses,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    total: expenses.reduce((sum, entry) => sum + entry.amount, 0),
    merchants: group(expenses),
    highlights,
    recurring,
    largestCharges: [...expenses].sort((a, b) => b.amount - a.amount).slice(0, largest),
  };
}
