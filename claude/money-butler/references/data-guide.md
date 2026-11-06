# Ben's Money data guide

- Money fields named `*_cents` are integer cents. Other currencies are excluded from USD totals unless explicitly converted with a dated rate.
- `Personal total` is a progress measure: active USD personal financial asset balances excluding property, plus known mortgage principal paid. It is **not** net worth. Net worth is assets, including recorded property, minus liabilities; missing balances make it partial.
- Holdings break down investment account balances. Do not add holding values to account balances. Securities metadata may be missing or stale; fund look-through from public disclosures is a separate, dated estimate.
- Pending and voided transactions do not count as realized cash flow. Transfers are not income or expense.
- Investment transactions are distinct from bank spending. Buys, sells, dividends, fees, and cancellations support portfolio analysis but do not directly change the site's saved account balance. `amount_cents` follows the provider's sign convention; inspect `type` and `subtype` before classifying.
- Debt terms in `liability_details` depend on explicit provider consent and institution coverage. The profile may hold a manual APR when a provider does not. Report conflicting or stale values instead of silently choosing one.
- Inventory counts include archived and historical records. Snapshot totals generally use active accounts. Read account archive flags and audit history before explaining a discrepancy. Sources and dates accompany each record.
- A successful Ben's Money sync means cached provider data was saved. `last_sync` is a site timestamp, not proof of an institution refresh. Coverage may begin later than the requested period, especially for older bank links.
