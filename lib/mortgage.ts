import type { Account } from "./models.ts";

export type Mortgage = {
  account_id: string;
  original_principal: number | null;
};

export type Payment = {
  month: number;
  date: string;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
};

export type Projection = {
  rows: Payment[];
  interest: number;
  paidOff: boolean;
  reason: string | null;
};

export const isMortgage = (account: Account) =>
  account.type === "Mortgage" ||
  (account.type === "Loan" && /mortgage/i.test(`${account.institution} ${account.name}`));

export function mortgageProgress(accounts: Account[], mortgages: Mortgage[]) {
  const loans = accounts.filter(account =>
    !account.archived && account.currency === "USD" && isMortgage(account));
  if (loans.length === 0) return { left: null, paid: null, count: 0 };

  const balances = loans.map(account => account.balance);
  const left = balances.every(balance => balance !== null)
    ? balances.reduce<number>((sum, balance) => sum + (balance ?? 0), 0)
    : null;
  const originals = loans.map(account =>
    mortgages.find(mortgage => mortgage.account_id === account.id)?.original_principal ?? null);
  const paid = left !== null && originals.every((value, index) =>
    value !== null && value >= balances[index]!)
    ? originals.reduce<number>((sum, value) => sum + (value ?? 0), 0) - left
    : null;
  return { left, paid, count: loans.length };
}

export function monthAfter(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result.toISOString().slice(0, 10);
}

// Monthly amortization in cents. Escrow, fees, and future rate changes are excluded.
export function amortize(
  balance: number,
  rate: number,
  payment: number,
  asOf: string,
  nextDue: string | null = null,
  extra = 0,
): Projection {
  const rows: Payment[] = [];
  if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isFinite(rate) ||
      rate < 0 || rate > 40 || !Number.isSafeInteger(payment) || payment <= 0 ||
      !Number.isSafeInteger(extra) || extra < 0) {
    return { rows, interest: 0, paidOff: false, reason: "Enter valid principal, rate, and payment values." };
  }
  if (balance === 0) return { rows, interest: 0, paidOff: true, reason: null };

  let interestTotal = 0;
  const first = nextDue && nextDue > asOf ? nextDue : monthAfter(asOf, 1);
  for (let month = 1; month <= 720 && balance > 0; month++) {
    const interest = Math.round(balance * rate / 1200);
    if (payment + extra <= interest) {
      return { rows, interest: interestTotal, paidOff: false, reason: "Payment does not cover monthly interest." };
    }
    const paid = Math.min(payment + extra, balance + interest);
    const principal = paid - interest;
    balance -= principal;
    interestTotal += interest;
    rows.push({ month, date: monthAfter(first, month - 1), payment: paid, principal, interest, balance });
  }
  return {
    rows,
    interest: interestTotal,
    paidOff: balance === 0,
    reason: balance > 0 ? "Projection exceeds the 60-year limit." : null,
  };
}

export function annualSchedule(rows: Payment[]) {
  const years = new Map<string, { year: string; principal: number; interest: number; balance: number }>();
  for (const payment of rows) {
    const year = payment.date.slice(0, 4);
    const current = years.get(year) ?? { year, principal: 0, interest: 0, balance: 0 };
    current.principal += payment.principal;
    current.interest += payment.interest;
    current.balance = payment.balance;
    years.set(year, current);
  }
  return [...years.values()];
}
