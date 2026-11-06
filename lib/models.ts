export type Account = {
  id: string;
  type: string;
  institution: string;
  name: string;
  currency: string;
  balance: number | null;
  archived: boolean;
};

export type Snapshot = {
  account_id: string;
  date: string;
  balance: number;
};

// A saved transaction. Amounts are positive integer cents; `kind` says which way the money moved.
export type Entry = {
  id: string;
  account_id: string | null;
  kind: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  description: string;
  pending: boolean;
  voided: boolean;
};
