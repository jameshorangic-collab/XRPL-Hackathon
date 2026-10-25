# Financial model

## Accounting conventions

All money is integer USD cents. The local mock ERC-20 has two decimals so token units and domain units match. Rates are annual basis points. Monetary percentages round down to a cent; display ratios may round to two decimal places. Inputs are bounded to protect JavaScript integer precision. A facility lasts exactly 365 days, with principal and coupons paid at maturity. Under this timing convention a fully repaid investor's coupon rate equals its annual return. Amortizing loans, intra-year fees, and multi-period IRR/DCF are unsupported and are not approximated by adding percentages.

The financing identity is:

`portfolio principal = senior capital + external junior capital + originator retention`

The seed is $100,000 = $80,000 + $15,000 + $5,000. Retained and external junior capital fund the portfolio; neither is an extra collateral reserve. Retention is fixed for each request (minimum $1,000), first in the loss order, and receives no fixed coupon. Junior investors rank equally with each other.

## Pricing and feasibility

Projected gross interest is the sum of each synthetic loan's principal times its contractual coupon. Senior and junior coupon costs use submitted offer rates and awarded amounts. The projected collection fee is `floor((principal + contractual interest) × feeBps / 10,000)`. The displayed annual financing cost divides these dollar costs by total portfolio principal. This is a portfolio-level funding-cost ratio, not a quoted investor yield or a cost ratio on external funding alone.

For the seed, gross annual contractual interest is $15,075. Senior interest is $6,400, junior interest is $2,525, and projected fees are $575.37. Total projected financing cost is $9,500.37 (9.50037% of $100,000), leaving $5,574.63 before credit losses and any additional operating costs. No contractual interest is guaranteed. The engine requires projected cash support and cost within the originator's ceiling; it does not validate credit underwriting.

## Principal-only stress chart

For recovered principal R, pay senior principal first, then external junior principal, then retained principal. Accordingly losses hit retained capital first, then external junior, then senior. External junior recoveries are shared pro rata. At 85% recovery, senior receives $80,000, external junior $5,000, and originator $0. At 70%, senior receives $70,000 and both subordinated layers receive $0.

This chart excludes coupons and fees. It is not a contractual guarantee of senior protection in the full cash waterfall.

## Full maturity cash waterfall

Given actual modeled total cash collections, allocate in this order:

1. Collection fee, a percentage of actual collections.
2. Senior coupon, capped by available cash.
3. Senior principal.
4. External junior principal, pro rata by funded principal.
5. Junior coupons, pro rata by coupon amounts due.
6. Originator retained principal.
7. All residual cash to the originator.

Every distribution is capped by cash available. Insufficient coupons are reported as unpaid, not silently made whole. Principal shortfalls are losses at final settlement. A final eligible recipient receives cent rounding residue; an investor with zero interest due cannot receive interest rounding residue. Solidity uses the same order and rounding rules. All claim assignments plus the fee equal collections. Unsolicited token transfers to the contract are not reported collections and are excluded from the modeled ledger.

Fees and senior coupons are ahead of principal in this full model. Thus principal-only stress output and the full contract settlement can differ even for the same nominal principal recovery. The UI labels and displays both separately.

## Portfolio risk assumptions

Five unsecured synthetic small-business loans have assumed PD, recovery, risk grades, and current/watch statuses. Assumed expected loss is Σ principal × PD × (1−recovery), with monetary rounding at each stage. The weighted coupon and maturity are principal-weighted. Sector concentration is the largest sector balance / total balance. Expected loss, user-selected stress loss, full possible loss, contractual interest, and realized cash collections are distinct. There is no historical dataset, validated PD model, default oracle, or empirically established performance prediction.
