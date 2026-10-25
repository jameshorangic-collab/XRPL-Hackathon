# Financial model

## Accounting conventions

All money is integer USD cents; annual simple rates are basis points. Interest is `floor(principal × rateBps × termMonths / 120000)`. Percentages round down to cents; the monthly underwriting reserve rounds up. Investor return estimates assume full maturity payment and are not guaranteed. There is no amortization, multi-period IRR, or real credit prediction.

New individual applications support 6, 12, and 24-month bullet terms; the preserved portfolio engine and Solidity fixture retain a 12-month/365-day bullet. The local mock token has two decimals and is not RLUSD. The wallet adapter converts cents into token units using actual decimals and rejects amounts not exactly representable.

## Underwriting

Cash available per month = revenue − operating expenses − existing debt payments. Preliminary reserve uses a 15% coupon; its coverage selects a demo indicative annual cap of 12% for coverage ≥2, 15% for coverage ≥1.25, otherwise 18%. Final reserve uses that cap and the requested term. This two-stage rule is deterministic and disclosed, not a validated pricing model.

Final reserve = ceiling((principal + term interest) / termMonths). Coverage = cash available / reserve. Eligible requires positive cash, coverage ≥1.25 and ≥1 year operating history. Coverage below 1 or nonpositive cash is declined; borderline coverage or shorter history needs explicit demo review. All inputs remain unverified. Synthetic PD/recovery assumptions do not come from an AI or credit bureau.

The example $10,000, 12-month application has $9,000 monthly cash available, a $933.34 reserve at a 12% indicative cap, and 9.64× coverage. Selected whole-loan investor coupons become actual modeled borrower interest; the cap does not create hidden residual spread. A $10,000 allocation at 8% pays $800 modeled term interest if fully collected.

## Funding identity and reservations

`portfolio principal = senior + mezzanine + external junior + originator contribution`

Retention is funded principal, never extra collateral. Quotes reserve simulated cash but do not count as funded. First commitment locks the accepted structure and releases losing/excess quote amounts. Committing deducts the investor's actual simulated cash; retained contribution separately deducts the synthetic originator's cash. Repeated commitments, overfunding, duplicate active positions, and insufficient cash are rejected. Final settlement is allowed only with complete capital and runs once.

With the loaded three-layer fixture: $100,000 = $80,000 senior + $10,000 mezzanine + $5,000 junior + $5,000 retained. Its 8% / 12% / 16% quoted coupons cost $6,400 + $1,200 + $800. The projected fee is $575.37, giving **$8,975.37** total projected financing cost. The underlying five loans have $15,075 contractual interest. Actual collections may be lower.

Without mezzanine quotes, the original optimum remains $80,000 senior + $15,000 external junior + $5,000 retained, with $9,500.37 projected cost. The Solidity fixture still implements only this two-layer structure.

## Principal-only recovery stress

Return principal to senior, then mezzanine, then junior, then originator. Losses absorb in the reverse order. At 85% principal recovery on the three-layer fixture, senior gets $80,000 and mezzanine $5,000; junior and originator get zero. At 70%, senior gets $70,000 and all subordinate principal is lost.

This illustration excludes coupons and fees and assumes the entire accepted structure is funded. It differs from full cash settlement.

## Final cash waterfall

Portfolio collections = recovered principal + collected contractual interest. Pay:

1. Collection fee, as a percentage of actual collections.
2. Senior interest, then senior principal.
3. Mezzanine interest, then mezzanine principal.
4. Junior principal, then junior interest.
5. Originator retained principal, then all residual cash to originator.

Whole-loan investments use principal then interest with no collection fee or originator spread. Same-rank payouts use deterministic pro rata cents; a final eligible recipient receives rounding residue. Cash is capped at available collections. Unpaid coupons and final principal losses are reported separately. Fee + investor payouts + retained principal + residual = collections, with zero unallocated cash.

At 70% principal recovery and zero collected interest on the three-layer fixture: collections $70,000, fee $350, senior coupon $6,400, senior principal $63,250; all other investors receive zero. The principal-only senior recovery is higher because it excludes priority fees/coupons. The preserved senior/junior Solidity waterfall matches the corresponding no-mezzanine domain model.

## Risk assumptions

Synthetic expected loss is the sum of principal × assumed PD × (1 − assumed recovery), with intermediate cents rounded down. It is separate from stressed loss, full possible exposure, promised coupons, and realized cash. No empirical dataset, validated default probability, loan ownership, servicing oracle, or regulatory capital treatment is established.
