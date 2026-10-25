# Security and trust boundaries

The contracts are unaudited prototype code. Use only a disposable local network or dedicated testnet wallet and mock assets. No real funds or borrower data are needed.

## Implemented controls

- OpenZeppelin `SafeERC20` and `ReentrancyGuard`; state updates occur before external token transfers.
- Immutable token, participants, allocations, rates, fee, terms hash, and funding deadline.
- Nonzero and unique participant checks; bounded junior participant count and rate/fee ranges.
- Investor commitments require an exact registered allocation and can occur once per participant. Unknown investors and duplicate funding revert.
- Activation requires all capital, occurs once, and is restricted to the originator. Funding is gated by its deadline.
- Active commitments cannot be withdrawn. Expired funding can be cancelled, followed by one refund per funded investor.
- Collection and settlement require the originator. Settlement is gated by maturity and can occur once. No post-settlement collection is allowed.
- Claims use pull withdrawals and are zeroed before transfer. Duplicate claims fail.
- Principal and interest distributions are capped by cash. Junior distributions use pro rata weights with deterministic rounding residue; zero-coupon participants do not receive interest residue.
- Deposits require the exact token balance increment, rejecting fee-on-transfer behavior. Only the immutable token is used.
- The automated UI adapter checks chain 31337 before using unlocked local signers or time travel. Testnet deployment checks 1449000. Real hashes are shown only after mined success receipts.
- `.env` is ignored. No private keys or service credentials are embedded in source or frontend configuration. RPC URLs that may contain credentials are not logged by the receipt verifier.

## Remaining limits

The mock token can be minted by anyone and has no peg or reserves. The originator receives funded capital and reports borrower collections; the contract does not enforce loan ownership, servicing quality, collateral, or truthful loss reporting. There is no oracle, legal collection process, signed investor order, KYC, suitability workflow, custody integration, or production authorization. Off-chain constraint checks are not independently revalidated against signed orders in the contract. Anyone can deploy the standalone contract with their own terms.

The browser is a local demo. localStorage is editable and no server validates simulated commitments. Demo roles and explicit demo-operator approval are not authorization. Version-2 bid reservations and browser locks reduce accidental double allocation but do not replace a production ledger. New individual loans support 6/12/24-month bullet terms; the legacy contract remains annual. No arbitrary cash-flow schedules are supported. Public testnet deployment is scripted but has not been executed.

Unsolicited token transfers are not credited as borrower collections. This keeps the reported cash ledger explicit but can leave unsolicited tokens stranded. Supporting token rescue would require governance and allocation rules beyond the current prototype.

## Dependency audit

`npm audit --omit=dev` returned zero reported vulnerabilities after removing unused charting dependencies. Full development audit still reports advisories in the Hardhat 2/toolbox dependency tree. The test runner and Vite were upgraded to current releases, resolving the previously observed critical advisories. They are not bundled as application runtime dependencies. `npm audit fix` was run; resolving the remaining advisories requires major development-tool migrations and is an open engineering task. Keep the dev environment local and do not treat this audit as a security certification. Exact counts are recorded in the final handoff and evidence.

## v0.2 integration boundaries

AWS, AP4M, and QuickNode use optional trusted-server gateway interfaces; no server implementation or privileged browser key is included. API responses require validation and independent authorization on the future server. A syntactically valid payment hash is not independently verified payment evidence. Missing configuration and failed requests never create a successful simulated external payment. The wallet adapter checks chain, token, terms hash, balance, allocation, and mined status; the marketplace has no verified facility binding and uses simulation. Persistent demo profiles must contain synthetic information only.
