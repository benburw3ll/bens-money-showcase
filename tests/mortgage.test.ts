import test from "node:test";
import assert from "node:assert/strict";
import { amortize, annualSchedule, monthAfter, mortgageProgress } from "../lib/mortgage.ts";
import type { Account } from "../lib/models.ts";

const account = (id: string, type: string, balance: number | null): Account => ({
  id, type, balance, institution: "Example lender", name: id, currency: "USD", archived: false,
});

test("a 30-year loan amortizes to zero in cents", () => {
  const projection = amortize(30_000_000, 6, 179_866, "2026-10-31", "2026-11-01");
  assert.equal(projection.paidOff, true);
  assert.equal(projection.rows.length, 360);
  assert.equal(projection.rows.reduce((sum, row) => sum + row.principal, 0), 30_000_000);
  assert.equal(projection.rows.at(-1)?.balance, 0);
});

test("recorded original principal determines paid-down amount", () => {
  const loan = account("loan", "Mortgage", 24_000_000);
  assert.deepEqual(mortgageProgress([loan], []), { left: 24_000_000, paid: null, count: 1 });
  assert.deepEqual(mortgageProgress([loan], [{ account_id: "loan", original_principal: 30_000_000 }]),
    { left: 24_000_000, paid: 6_000_000, count: 1 });
});

test("extra payments reduce interest and term", () => {
  const base = amortize(24_000_000, 6, 160_000, "2026-10-31");
  const extra = amortize(24_000_000, 6, 160_000, "2026-10-31", null, 20_000);
  assert.ok(extra.rows.length < base.rows.length);
  assert.ok(extra.interest < base.interest);
});

test("dates clamp to the last day of shorter months", () => {
  assert.equal(monthAfter("2028-01-31", 1), "2028-02-29");
  assert.equal(monthAfter("2027-01-31", 1), "2027-02-28");
});

test("annual totals reconcile with the monthly schedule", () => {
  const projection = amortize(30_000_000, 6, 179_866, "2026-10-31");
  const annual = annualSchedule(projection.rows);
  assert.equal(annual.reduce((sum, row) => sum + row.principal, 0), 30_000_000);
  assert.equal(annual.reduce((sum, row) => sum + row.interest, 0), projection.interest);
});

test("invalid or insufficient payment values report no payoff", () => {
  assert.equal(amortize(-1, 5, 100, "2026-10-31").paidOff, false);
  assert.equal(amortize(10_000_000, 12, 100_000, "2026-10-31").paidOff, false);
});
