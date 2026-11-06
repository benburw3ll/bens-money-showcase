# Example Money Butler review (fictional)

> **Everything on this page is invented.** It shows what a Money Butler run looks like against a fictional demo dataset. Every person, institution, account, merchant, and number is made up. It is a demo of the workflow, not financial advice.
>
> The mortgage figures were computed with this repository's own [`lib/mortgage.ts`](../lib/mortgage.ts): `amortize(21_400_000, 5.75, 165_000, "2026-10-31", "2026-11-30")`, plus the same call with `extra = 20_000`.

## 1. Tool calls

Abbreviated results; amounts from the server are integer cents.

```text
mcp__bensmoney__list_connections {}
  → 1 connection: conn_demo_01 · Northstar Bank (demo) · transactions · last_sync 2026-10-30T14:02Z

mcp__bensmoney__sync_connection {"connection_id":"conn_demo_01"}
  → ok · last_sync 2026-10-31T09:15Z · sync_in_progress false
    (saved the aggregator's cached data; not proof the bank refreshed)

mcp__bensmoney__get_data_inventory {}
  → accounts 8 · transactions 318 · holdings 2 · securities 2
    investment_transactions 0 · balance_history 48 · liability_details 0 · mortgages 1 · audit 120
    planning_profile: not set

mcp__bensmoney__get_financial_snapshot {"months":12}
  → net worth 26,611,000 · personal total 18,235,000 (progress measure, not net worth)
    mortgage: balance 21,400,000 · original 26,000,000 · rate 5.75 · P&I 165,000
    holdings 2,460,000

mcp__bensmoney__get_financial_records {"dataset":"transactions","limit":200,"offset":0}    → next_offset 200
mcp__bensmoney__get_financial_records {"dataset":"transactions","limit":200,"offset":200}  → 118 rows, next_offset null
mcp__bensmoney__get_financial_records {"dataset":"holdings"}           → 2 rows, next_offset null
mcp__bensmoney__get_financial_records {"dataset":"balance_history"}    → 48 rows, next_offset null
mcp__bensmoney__get_financial_records {"dataset":"mortgages"}          → 1 row, next_offset null
```

## 2. The review

**Sources.** Balances are manual entries dated 2026-10-31. Transactions come from one demo bank connection, synced 2026-10-31, covering May to October 2026. Nothing is known about the 401(k) and HSA holdings, liability terms for the card, or goals: the planning profile is empty.

### Where things stand

| | Amount | Notes |
| --- | ---: | --- |
| Cash | $23,050 | Everyday Checking $4,800 + Rainy Day Savings $18,250 (Northstar Bank) |
| Invested | $113,300 | Brokerage $24,600 · 401(k) $82,300 · HSA $6,400 |
| Home | $345,000 | Owner's estimate, not an appraisal |
| Mortgage | −$214,000 | of $260,000 original; 5.75%; $1,650/mo principal and interest |
| Rewards Card | −$1,240 | APR unknown |
| **Net worth** | **$266,110** | Assets $481,350 − debts $215,240 |
| Personal total | $182,350 | Cash + invested + $46,000 mortgage principal paid. A progress measure, not net worth. |

- **Cash flow (personal, six months):** about $6,400/month in and $5,150/month out, so roughly $1,250/month of surplus.
- **Liquidity:** $23,050 in cash covers about **4.5 months** of current personal spending.
- **Brokerage:** two funds. DEMO-A Fictional Total Market Fund is $18,000 (cost $15,000, +20%). DEMO-B Fictional Bond Fund is $6,600 (cost $6,400, +3%). That is about 73% stock and 27% bond. Holdings match the account balance exactly, so nothing is double counted. These are fictional tickers, so no look-through was attempted.
- **Mortgage:** at the regular payment it pays off in **October 2043** (204 payments), with **$121,316.78** of interest still to come. This month's payment is $1,025.42 interest and $624.58 principal.

### Next steps, ranked

1. **Fill in the planning profile** (high impact, needed first). Without goals, an emergency-fund target, risk tolerance, time horizon, or tax context, the steps below are provisional. *Would change:* everything below.
2. **Confirm the Rewards Card terms.** There are no liability details and no manual APR. If the $1,240 is paid in full each month, it costs nothing. If it revolves at a typical card rate, paying it off beats every other option here. *Confidence:* high once the APR is known.
3. **Decide the emergency-fund target before investing the surplus.** 4.5 months of spending is within a common 3–6 month range. *Would change:* job stability and upcoming cash needs.
4. **Weigh $200/month of extra principal against investing it.** With the extra $200, payoff moves to **December 2040** (170 payments, **34 months sooner**) and saves **$22,587.17** of interest. That is a guaranteed return at the loan's 5.75% rate. *Tradeoff:* the money becomes illiquid home equity. An unclaimed 401(k) employer match, or tax-advantaged room in the 401(k) or HSA, may come first. *Confidence:* medium. The math is exact under constant-rate assumptions, but the comparison depends on the missing match and tax details.
5. **Get the 401(k) and HSA holdings.** They are 78% of invested assets, but no holdings are recorded, so overall allocation and concentration can't be assessed. *Would change:* the allocation picture in this review.

**Not reviewed:** investment activity (no records), card liability terms (no consent or data), and fund look-through (fictional funds). Estimates assume on-time payments, a constant rate, and no fees.
