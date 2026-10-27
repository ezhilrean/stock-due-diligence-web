# Stock Due Diligence MCP server

A separate, read-only MCP service for the existing Stock Due Diligence website. It does **not** replace the GitHub Pages site, change the plugin's identity, or deploy anything by itself.

## Tools included

- `search_sec_company`: search the SEC company ticker list by ticker or name.
- `get_sec_company_facts`: return selected annual reported facts from the SEC Company Facts API, with filing metadata and limitations.
- `due_diligence_checklist`: create a research checklist for US, India, or other markets.

The service does not scrape or invent live stock prices, does not make trades, and does not store user research notes. It is read-only and provides research support, not personalized investment advice.

## Run locally

Requires Node.js 20 or newer.

```sh
cd mcp-server
npm install
SEC_USER_AGENT="Stock Due Diligence contact your-real-email@example.com" npm start
```

Health endpoint: `http://localhost:3000/health`

MCP endpoint: `http://localhost:3000/mcp`

Set `SEC_USER_AGENT` to an identifying application name and a real contact email before using SEC tools. Do not commit private keys, passwords, or access tokens.

## Deploy as a separate service on Render

1. Push this branch to GitHub and review the pull request.
2. In Render, create a new Web Service from this repository and use the included `mcp-server/render.yaml` blueprint, or configure a Docker service with the repository root as the Docker context and `mcp-server/Dockerfile` as the Dockerfile.
3. Set `SEC_USER_AGENT` to an identifying app name and a monitored contact email.
4. Deploy and test `/health`.
5. Configure the platform's MCP connection to the deployed HTTPS endpoint ending in `/mcp`, once it is available.
6. Test tool discovery and calls against the exact deployed endpoint before changing the plugin submission.

The generated Render URL will be assigned by Render; do not use a guessed URL in plugin metadata. GitHub Pages remains independently deployed using the existing workflow and custom domain.

## Security and production notes

- The tools are read-only and no database credentials are needed.
- A basic per-IP rate limit is included. It is not a substitute for production-grade abuse protection, monitoring, or authentication if required by the hosting/platform policy.
- SEC access requires a descriptive User-Agent and must respect SEC fair-access guidance.
- Do not treat company facts as normalized accounting data. Confirm material numbers in source filings.
- Before public release, verify the deployment's TLS, logging, monitoring, rate limits, service terms, and applicable platform authentication requirements.
- This code does not implement OAuth or subscription billing.
