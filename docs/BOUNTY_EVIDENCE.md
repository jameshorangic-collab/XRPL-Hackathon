# Genuine integration evidence

All underlying businesses and financial records are synthetic. No real lending capital was transferred.

## AWS

Existing Harness: `arn:aws:bedrock-agentcore:us-east-2:141023342618:harness/harness_3gvmy-D1P2aCSQOX`.

Region us-east-2. Verified per-invocation model override: `us.amazon.nova-2-lite-v1:0`. No Harness was created or replaced. Initial verified request: `e345f465-5cd5-479c-bd9c-bd67e2c3f753`. Final browser assessment after the paid report: `1b60f00b-46da-4bfa-9dd4-66a4bc46be6a`.

The final browser assessment explicitly used the synthetic report's $17,800 deposits, $12,900 outflows, six-month sample and debt reconciliation. Deterministic cash/eligibility stayed authoritative. Evidence: [aws-harness-invocation.json](evidence/aws-harness-invocation.json) and server run evidence. Default Anthropic access failed because account use-case details were missing; the existing Harness succeeded with the Nova override. No claim is made that the default model was repaired.

## AP4M and XRPL EVM Testnet

- Team: Just Create Something.
- Channel: `0x5581e5dd8bac0f5756de6851e0b938b3413ad34b794fee821ea81de67b242dea`.
- Price: **0.01 test RLUSD**; channel cap **1 RLUSD**, from the organizer-provided budget.
- Agent: `0xAdAFA40c9c9b87Fa52ea898Cbb74aCeA6fc2f94A`.
- Merchant payout: `0x6B0dc1580B7b14E0Bd35bbdDF6fbFDb536E7ef3c`.
- Official token: `0x27b57a9D0b8d24EB97259c4E2279e45255e016f3`, 18 decimals.
- PaymentLedger: `0xcAB42800A5ECF0D253Fa2581Bb3334B4DAEfaE91`.
- Claim: `0x3c26424964d54403131fcfe6c7555f5b817ddd3d6542b7a444ecefb3e6d08eea`.

[Actual VoucherRedeemed transaction](https://explorer.testnet.xrplevm.org/tx/0x01e4df46fe7f04147eabd8226576109070982e1acb298a2dc05d9f6a01a6a00f), status 1, block 9235839.

[Actual merchant payout transaction](https://explorer.testnet.xrplevm.org/tx/0xa5932aceb622d50bc1868bc4088b87d96efc6dcf0ead92ebb631efbd637b07ba), status 1, block 9235872.

The exact vault ClaimPaid event and token Transfer to the registered merchant were verified. Merchant token balance reached 10,000,000,000,000,000 base units (0.01 RLUSD). Evidence: [ap4m-testnet-payment.json](evidence/ap4m-testnet-payment.json).

The report merchant implemented the official x402 challenge, signed voucher plus resource binding, on-chain redemption and report unlock. This was not an ordinary ERC-20 transfer substituted for AP4M. Signatures were approved interactively by the user. Fully autonomous wallet signing and all sponsor award eligibility conditions have not been established.

## QuickNode

Actual authorized private endpoint usage: chain ID, current block, account balances, redemption receipt, canonical blocks, VoucherRedeemed, vault ClaimPaid and payout token Transfer. Proof records identify QuickNode and contain genuine chain evidence. Private URL withheld from source, logs and reports. The plan's five-block log limit is handled by split queries.

## Limits

No genuine investor loan-funding transaction, public three-layer lending contract, native XRPL loan, validated underwriting, real bank data, or regulatory compliance claim. The real payment purchased fictional data; the $50,000 portfolio and its investor commitments remain illustrative/simulated. Live sponsor operations are verified locally; remote hosting requires the configuration described in INTEGRATIONS.
