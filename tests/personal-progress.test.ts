import test from "node:test";
import assert from "node:assert/strict";
import { personalProgress, personalProgressHistory } from "../lib/personal-progress.ts";
import type { Account } from "../lib/models.ts";

const account = (id: string, type: string, balance: number | null, extra: Partial<Account> = {}): Account => ({
  id, type, balance, institution: "Example", name: id, currency: "USD", archived: false, ...extra,
});

test("personal progress adds eligible balances and mortgage principal paid", () => {
  const accounts = [
    account("bank", "Checking", 200_000), account("retirement", "401(k)", 6_000_000),
    account("home", "Property", 40_000_000), account("loan", "Mortgage", 24_000_000),
    account("card", "Credit card", 200_000),
  ];
  const result = personalProgress(accounts, [{ account_id: "loan", original_principal: 30_000_000 }]);
  assert.equal(result.accountBalances, 6_200_000);
  assert.equal(result.mortgagePaid, 6_000_000);
  assert.equal(result.total, 12_200_000);
});

test("missing principal and balances are flagged", () => {
  const result = personalProgress([
    account("cash", "Savings", 100_000), account("loan", "Mortgage", 24_000_000),
    account("invest", "Brokerage", null),
  ], []);
  assert.equal(result.total, 100_000);
  assert.equal(result.missingMortgages, 1);
  assert.equal(result.missingBalances, 1);
});

test("archived and non-USD accounts are excluded", () => {
  const result = personalProgress([
    account("a", "Checking", 10_000),
    account("b", "Savings", 99_999, { archived: true }),
    account("c", "Brokerage", 99_999, { currency: "CAD" }),
  ], []);
  assert.equal(result.total, 10_000);
});

test("history carries the latest prior balance forward", () => {
  const accounts = [account("bank", "Checking", 200_000), account("loan", "Mortgage", 24_000_000)];
  const result = personalProgressHistory(accounts, [
    { account_id: "bank", date: "2026-10-01", balance: 100_000 },
    { account_id: "loan", date: "2026-10-02", balance: 25_000_000 },
    { account_id: "loan", date: "2026-10-05", balance: 24_000_000 },
    { account_id: "bank", date: "2026-10-05", balance: 200_000 },
  ], [{ account_id: "loan", original_principal: 30_000_000 }]);
  assert.deepEqual(result, [
    { date: "2026-10-01", value: 100_000 },
    { date: "2026-10-02", value: 5_100_000 },
    { date: "2026-10-05", value: 6_200_000 },
  ]);
});
