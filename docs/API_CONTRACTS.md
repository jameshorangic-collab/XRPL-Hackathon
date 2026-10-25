# Integration contracts

These are BACKSTOP-owned typed gateway boundaries, not claims of deployed sponsor integrations. The repository includes client adapters and tests; the privileged server implementations remain future work. The default app starts with no credentials.

`VITE_API_BASE_URL` is public. Use a trusted HTTPS server (loopback HTTP is allowed for development). It must not contain credentials, query parameters, or fragments. Requests have a 15-second timeout and useful HTTP/payment errors. Production must add authenticated users, authorization, rate limits, durable idempotency, CORS policy, data retention controls, and independent settlement verification. Client-side validation is not a server security boundary.

## Status

`GET /api/integrations/status` returns:

```json
{
  "services": [
    {
      "id": "aws",
      "status": "Demo mode",
      "detail": "Deterministic rules; no invocation."
    },
    {
      "id": "ap4m",
      "status": "Not configured",
      "detail": "No settlement configured."
    },
    {
      "id": "quicknode",
      "status": "Not configured",
      "detail": "No RPC gateway configured."
    },
    {
      "id": "xrpl",
      "status": "Demo mode",
      "detail": "No verified marketplace facility."
    }
  ]
}
```

Allowed statuses: `Connected`, `Not configured`, `Error`, `Demo mode`. The server must establish actual readiness before returning Connected. Invalid/unavailable endpoints show Error while local demo work remains available.

## AWS AgentCore

`UnderwritingProvider.assess(application, jobId)` has a deterministic demo implementation and an AWS gateway implementation. The latter sends `POST /api/underwriting/assess` with `{application, jobId}` and `Idempotency-Key: jobId`. Response:

```json
{
  "provider": "aws-agentcore",
  "invocationId": "actual-runtime-invocation-id",
  "reasoning": ["Explanation grounded in supplied facts."],
  "informationGaps": ["Verified bank statements remain unavailable."]
}
```

The server must invoke the actual runtime and return its real invocation ID. Financial facts, risk assumptions, and eligibility are recalculated locally by deterministic rules. A failed gateway leaves the job in Error, with retry using the same job identifier. No automatic approval is created on failure.

Server configuration: AWS region, runtime ARN, Bedrock model identifier, and an IAM role or local credential provider with appropriate invoke permissions. No AWS credential belongs in `VITE_` variables. [Official invocation documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-invoke-agent.html).

## Mastercard AP4M

`PaidReportProvider.purchaseReport(applicationId, reportType, requestId)` posts to the agent gateway `POST /api/reports/purchases`, body `{applicationId,reportType,requestId}`, header `Idempotency-Key: requestId`. The agent gateway is separate from the paid merchant endpoint. Responses use the `ReportPurchase` type in `src/domain/marketTypes.ts`, with the same IDs and `mode: "live"`.

Statuses: Agent evaluating need for report, Payment requested, Payment authorized, Report purchased, Report received, Payment failed. Completed purchases require a settlement transaction hash. The client checks its shape; only the future server can independently verify payment and authenticity. A hash string supplied by a server is not cryptographic evidence by itself.

Still to implement on that server: evaluate report necessity; merchant HTTP 402 requirements; agent budget and authorization; correct AP4M voucher creation/signing; merchant verification/redemption; actual RLUSD settlement and confirmation; durable replay protection; report retrieval; refunds/failure policy. Keep agent and merchant signing identities separate. Never fabricate signatures, vouchers, or receipts.

The [official AP4M guide](https://hackathon.ap4m.build/integration-guide) could not be retrieved during this refactor. Consequently no real AP4M protocol execution was implemented or claimed as validated against that guide. Re-read it with authorized participant access before building the server. Reserved `.env.example` values describe integration needs rather than verified sponsor SDK parameter names.

The unconfigured provider records no payment. The synthetic provider labels its fixture source and no-payment status; it cannot change eligibility. Received reports are not repurchased by repeated clicks in the demo.

## QuickNode

`QuickNodeAdapter` expects a server using a private `QUICKNODE_RPC_URL` or `XRPL_EVM_RPC_URL`:

| Endpoint                                               | Response                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `GET /api/blockchain/balance?address=...`              | `{address,balance,chainId}`; balance is an integer string in native base units |
| `GET /api/blockchain/receipts/:hash`                   | `{hash,chainId,status,blockNumber}`; status 0 or 1                             |
| `GET /api/blockchain/facilities/:address`              | `{chainId,facility,funded,target,state}`; token amounts are integer strings    |
| `GET /api/blockchain/facilities/:address/transactions` | receipt array                                                                  |

Receipt and funding reads validate chain 1449000. No configured gateway means Not configured, never a fabricated receipt. The existing `npm run verify:tx -- <hash>` CLI can independently use a locally configured RPC. [QuickNode EVM documentation](https://www.quicknode.com/docs/ethereum).

## XRPL EVM wallet

`XrplEvmAdapter` uses an injected EIP-1193 wallet through ethers. It exposes connection, chain verification, native/token balances, token-unit conversion, exact commitments, receipts, funding status, history, and event subscription cleanup. Transactions require the wallet's own approval. Rejections throw an actionable error without creating a hash or simulated success.

A `FacilityDescriptor` binds opportunity ID, facility address, token, terms hash, and network. The adapter verifies contract/token/terms/participant allocation, reads actual balance and allowance, checks approval and commitment receipts, and rejects unsupported whole-loan/mezzanine use of the preserved contract. No such descriptor is configured in the new marketplace UI.

Testnet is chain **1449000**, native gas XRP. See [official networks](https://docs.xrplevm.org/pages/operators/resources/networks) and [contract interaction](https://docs.xrplevm.org/pages/developers/interacting-with-evm/interact-with-the-smart-contract). No new contract deployment was needed for the refactor.

## Activation requirements

A trusted deployed backend/database; AWS runtime and IAM; AP4M participant/merchant setup and budget/signing configuration; private RPC; test XRP and appropriate test assets; verified facility deployment and binding; three-layer contract design if mezzanine is required on-chain; event indexing/reconciliation; failure/retry and wallet integration testing. Keep deployer/signing keys out of prompts and browser builds. The existing testnet deployment script deploys only the preserved senior/junior mock fixture.
