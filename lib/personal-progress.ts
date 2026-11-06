import type { Account, Snapshot } from "./models.ts";
import type { Mortgage } from "./mortgage.ts";

const debtTypes = new Set(["Credit card", "Loan", "Mortgage"]);
export const isHomeLoan = (account: Account) =>
  account.type === "Mortgage" ||
  (account.type === "Loan" && /mortgage/i.test(`${account.institution} ${account.name}`));
export const isPersonalAsset = (account: Account) =>
  account.type !== "Property" && !debtTypes.has(account.type);

// A user-selected progress metric, deliberately distinct from assets minus debts.
export function personalProgress(accounts: Account[], mortgages: Mortgage[]) {
  const active = accounts.filter(account => !account.archived && account.currency === "USD");
  const financial = active.filter(isPersonalAsset);
  const accountBalances = financial.reduce((sum, account) => sum + (account.balance ?? 0), 0);
  let mortgagePaid = 0;
  let missingMortgages = 0;
  for (const account of active.filter(isHomeLoan)) {
    const original = mortgages.find(mortgage => mortgage.account_id === account.id)?.original_principal;
    if (original == null || account.balance === null || account.balance < 0 || original < account.balance) {
      missingMortgages++;
      continue;
    }
    mortgagePaid += original - account.balance;
  }
  return {
    accountBalances,
    mortgagePaid,
    total: accountBalances + mortgagePaid,
    missingMortgages,
    missingBalances: financial.filter(account => account.balance === null).length,
  };
}

export function personalProgressHistory(accounts: Account[], snapshots: Snapshot[], mortgages: Mortgage[]) {
  const active = accounts.filter(account =>
    !account.archived && account.currency === "USD" && (isPersonalAsset(account) || isHomeLoan(account)));
  const relevant = snapshots.filter(snapshot => active.some(account => account.id === snapshot.account_id));
  return [...new Set(relevant.map(snapshot => snapshot.date))].sort().map(date => {
    const dated = active.map(account => {
      const snapshot = relevant
        .filter(item => item.account_id === account.id && item.date <= date)
        .sort((left, right) => right.date.localeCompare(left.date))[0];
      return { ...account, balance: snapshot?.balance ?? null };
    });
    return { date, value: personalProgress(dated, mortgages).total };
  });
}
