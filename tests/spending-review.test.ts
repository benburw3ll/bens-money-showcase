import test from "node:test";
import assert from "node:assert/strict";
import { reviewSpending, windowStart } from "../lib/spending-review.ts";
import type { Account, Entry } from "../lib/models.ts";

// Every institution, merchant, and amount below is invented test data.
const account = (id: string, institution: string, currency = "USD"): Account => ({
  id, institution, currency, type: "Checking", name: id, balance: 0, archived: false,
});
const expense = (id: string, account_id: string, description: string, amount: number, date: string, overrides: Partial<Entry> = {}): Entry => ({
  id, account_id, description, amount, date, kind: "expense", pending: false, voided: false,
  ...overrides,
});
const banks = ["Northstar Bank", "Harbor Credit Union"];
const delivery = { "Food delivery": /quick\s?eats/i };

test("uses only posted personal expenses from the selected institution", () => {
  const accounts = [account("n", "Northstar Bank"), account("h", "Harbor Credit Union"), account("o", "Other Bank")];
  const entries = [
    expense("1", "h", "QuickEats", 5000, "2026-08-01"),
    expense("2", "n", "QuickEats", 3000, "2026-08-03"),
    expense("3", "h", "QuickEats", 7000, "2026-08-04", { pending: true }),
    expense("4", "h", "QuickEats", 9000, "2026-08-05", { voided: true }),
    expense("5", "h", "QuickEats", 10000, "2026-08-06", { kind: "transfer" }),
    expense("6", "o", "QuickEats", 11000, "2026-08-07"),
  ];
  const amount = (institution?: string) =>
    reviewSpending(entries, accounts, { institutions: banks, institution, highlights: delivery }).highlights["Food delivery"].window.amount;
  assert.equal(amount(), 8000);
  assert.equal(amount("Harbor Credit Union"), 5000);
  assert.equal(amount("Northstar Bank"), 3000);
});

test("without an institution list, every USD account is reviewed", () => {
  const accounts = [account("n", "Northstar Bank"), account("o", "Other Bank"), account("eur", "Euro Bank", "EUR")];
  const entries = [
    expense("1", "n", "Corner Market", 1000, "2026-09-01"),
    expense("2", "o", "Corner Market", 2000, "2026-09-02"),
    expense("3", "eur", "Corner Market", 4000, "2026-09-03"),
  ];
  assert.equal(reviewSpending(entries, accounts).total, 3000);
});

test("highlights a merchant separately and never calls a repeat store purchase a subscription", () => {
  const accounts = [account("n", "Northstar Bank")];
  const entries = [
    expense("1", "n", "Example App Store", 2179, "2026-08-04"),
    expense("2", "n", "Example App Store", 2179, "2026-09-04"),
    expense("3", "n", "Example App Store", 8503, "2026-10-02"),
    expense("4", "n", "Corner Market", 999, "2026-08-10"),
    expense("5", "n", "Corner Market", 999, "2026-09-08"),
    expense("6", "n", "Corner Market", 999, "2026-10-08"),
    expense("7", "n", "Corner Market", 10000, "2026-10-11"),
  ];
  const result = reviewSpending(entries, accounts, {
    highlights: { "App store": /^example app store/i },
    recurringServices: /^(example music|example streaming)$/i,
  });
  assert.equal(result.highlights["App store"].window.amount, 12861);
  assert.equal(result.highlights["App store"].window.count, 3);
  assert.equal(result.merchants.find(item => item.name === "Corner Market")?.amount, 12997);
  assert.equal(result.recurring.find(item => item.name === "Corner Market"), undefined);
  assert.deepEqual(result.largestCharges.map(entry => entry.id).slice(0, 2), ["7", "3"]);
});

test("rolling windows include their boundary dates and filter every total", () => {
  assert.equal(windowStart("7d", "2026-10-31"), "2026-10-25");
  assert.equal(windowStart("14d", "2026-10-31"), "2026-10-18");
  assert.equal(windowStart("21d", "2026-10-31"), "2026-10-11");
  assert.equal(windowStart("1m", "2026-10-31"), "2026-09-30");
  assert.equal(windowStart("2m", "2026-10-31"), "2026-08-31");
  assert.equal(windowStart("3m", "2026-10-31"), "2026-07-31");
  assert.equal(windowStart("all", "2026-10-31"), null);
  const accounts = [account("h", "Harbor Credit Union")];
  const entries = [
    expense("old", "h", "QuickEats", 1000, "2026-10-24"),
    expense("start", "h", "QuickEats", 2000, "2026-10-25"),
    expense("end", "h", "QuickEats", 3000, "2026-10-31"),
    expense("future", "h", "QuickEats", 4000, "2026-11-01"),
  ];
  const result = reviewSpending(entries, accounts, { start: windowStart("7d", "2026-10-31"), end: "2026-10-31", highlights: delivery });
  assert.equal(result.highlights["Food delivery"].window.amount, 5000);
  assert.equal(result.highlights["Food delivery"].history.amount, 10000);
  assert.equal(result.total, 5000);
  assert.equal(result.expenses.length, 2);
  assert.deepEqual([result.firstDate, result.lastDate], ["2026-10-25", "2026-10-31"]);
});

test("a short window keeps service history but counts only charges inside the window", () => {
  const accounts = [account("h", "Harbor Credit Union")];
  const entries = [
    expense("aug", "h", "Example Music", 1416, "2026-08-21"),
    expense("sep", "h", "Example Music", 1416, "2026-09-21"),
    expense("oct", "h", "Example Music", 1416, "2026-10-21"),
  ];
  const result = reviewSpending(entries, accounts, {
    start: "2026-10-18", end: "2026-10-31", recurringServices: /^(example music|example streaming)$/i,
  });
  const music = result.recurring.find(item => item.name === "Example Music");
  assert.equal(music?.amount, 4248);
  assert.equal(music?.periodAmount, 1416);
  assert.equal(music?.periodCount, 1);
  assert.equal(music?.monthsSeen, 3);
  assert.equal(music?.lastDate, "2026-10-21");
});
