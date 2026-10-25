# Final Vercel deployment

Public application: **https://backstop-xrpl.vercel.app**.

The existing Horangic `backstop-xrpl` project was updated through the authenticated Vercel CLI. No new hosting project or paid infrastructure was created. Git pushes still do **not** automatically deploy.

- Deployment: `dpl_5PGF7QGqbwPGqJBdDHhLximwZ8pB`.
- Deployed source: `20b988b699ff39a2913067fed1a3d553c42e57b6`.
- [Vercel deployment details](https://vercel.com/horangic/backstop-xrpl/5PGF7QGqbwPGqJBdDHhLximwZ8pB).
- Production alias: https://backstop-xrpl.vercel.app.

## Verified publicly, without authentication

`/signup`, `/borrow`, `/invest`, `/dashboard`, `/api/health`, and `/api/integrations/status` all returned HTTP 200. The browser signup → bakery submission → deterministic fallback → refresh → investor portfolio flow passed. The five-business pool cleared at $35k senior / $8k mezzanine / $5k junior / $2k retention, $4,846 projected cost, with actual funding still zero.

The Node API is generated from `server/vercel.ts` into one self-contained `api/index.js` bundle; explicit rewrites support nested paths. The production build smoke-tests direct and rewritten health and nested integration status routes. This fixed the initial production-only extensionless-import and catch-all routing failures. Earlier Git-author blocking was resolved through a correctly associated account email; no history was rewritten. Repository-local future commits use the user-requested jameshorangic@gmail.com.

Evidence: [final-vercel-deployment.json](evidence/final-vercel-deployment.json) and [public screenshot](screenshots/final-vercel-live.jpg). The older deployment evidence remains a historical record of v0.1.

## Critical hosting distinction

**The full live sponsor workflow is verified locally, not remotely configured in Vercel.** The public site correctly reports AWS Demo mode, AP4M/QuickNode Not configured, and XRPL Demo mode. The existing public frontend remains functional through its labeled browser-local fallback.

The hosted API has no configured durable database, SESSION_SECRET/operator session, AWS server credential provider, private RPC, or persistent HTTPS AP4M worker. It refuses privileged writes/live purchases rather than using ephemeral serverless storage or claiming nonexistent connections. No local AWS credentials, private RPC URL, wallet keys, SDK retained signatures, or payment database were uploaded. `.env`, `.env.local`, `.backstop/`, and Vercel local metadata are ignored/excluded.

For the genuine integrated demonstration, use **http://127.0.0.1:3001** on the configured development computer with `npm run start:local` and `npm run ap4m:worker`. Actual AWS/AP4M/QuickNode evidence is recorded in [BOUNTY_EVIDENCE](BOUNTY_EVIDENCE.md). Remotely enabling that same workflow requires the durable backend/worker configuration in [INTEGRATIONS](INTEGRATIONS.md).

## Reproduce an update

```sh
npm run typecheck
npm run lint
npm test
npm run contracts:test
npm run build
npx vercel --prod --yes --scope horangic
```

The local directory is linked to the existing project in ignored `.vercel/project.json`. Confirm the production alias, all four pages and API status after deployment. Never assume a successful Git push updated Vercel.
