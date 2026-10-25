# Vercel deployment

The hosted application is **https://backstop-xrpl.vercel.app**.

Vercel project: https://vercel.com/horangic/backstop-xrpl, under the Horangic Hobby account. It was deployed from the compiled output of source commit `74fd700` on `feat/backstop-prototype` using Vercel's Drop to Deploy flow.

## What is hosted

The six files in `dist/` provide the browser application, styles, JavaScript, and precompiled local contract artifacts. No credentials, `.env` file, development logs, or repository metadata were uploaded. Each deployed file was fetched without authentication and matched byte for byte to the local production build. The public browser flow was checked for unfunded rejection and the $9,500.37 competitive clearing result.

This deployment supports the marketplace, offer editing, deterministic clearing, portfolio analytics, browser commitment simulation, and stress waterfalls. Its data remains per-browser localStorage. It does not add a shared backend, authentication, a remote EVM node, or a public testnet deployment. The real local-chain lifecycle still requires a separately running local node; Vercel does not run Hardhat for visitors.

## Updates

This is a direct static deployment. GitHub pushes do **not** automatically update this Vercel project. The existing Vercel GitHub integration could not access `XRPL-Hackathon`, so no additional GitHub permissions were granted.

To update manually, run `npm run build`, zip the contents of `dist/` with `index.html` at the archive root, and upload that build to the existing Vercel project. For automatic Git deployments, configure Vercel's GitHub integration to access this repository and select the branch containing the app.

Deployment and asset verification evidence is saved in [evidence/vercel-deployment.json](evidence/vercel-deployment.json). The prior local engineering handoff remains a record of the original implementation and testnet limitations.
