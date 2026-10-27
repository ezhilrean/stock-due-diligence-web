# Stock Due Diligence Web

A responsive static stock research dashboard hosted with GitHub Pages. Built with HTML, CSS, and vanilla JavaScript; no build step or API key is required.

**Live website:** https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com/

## Features
- Investment overview and watchlist summary
- Searchable/filterable stock screener
- Five-year discounted cash-flow (DCF) calculator with sensitivity analysis
- Interactive due-diligence checklist
- Add-stock form and CSV watchlist export
- Supabase email/password registration, Google sign-in, and password-reset email
- Per-account persistence for watchlists, DCF assumptions, checklist progress, and research notes/reports
- Responsive layout and light/dark theme

## Deploy to GitHub Pages
This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. Pushes to `main` trigger a deployment.

1. Open **Settings → Pages** in this repository.
2. Set the build and deployment source to **GitHub Actions**.
3. Wait for the workflow in the Actions tab to complete successfully.
4. The custom domain is configured through the `CNAME` file in the repository.

## Custom domain
The site uses `https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com/`. The DNS provider for `mesprk.com` must have a CNAME record for `stock-due-diligence-web.chatgpt-plugin.public` pointing to `ezhilrean.github.io`. Configure HTTPS in **Settings → Pages** once GitHub Pages verifies the domain.

## Supabase authentication and database
See [SETUP.md](SETUP.md) for the one-time Supabase setup. Apply [supabase/schema.sql](supabase/schema.sql), configure `supabase-config.js` with the Supabase project URL and public anon/publishable key, enable Email and Google providers, and allow the custom domain in Supabase Auth URL settings. Login and database access will remain unavailable until this setup is completed. Never commit a service-role or secret key.

## Important data note
The included stock prices, financial metrics, and quality scores are illustrative demo values, not live market data or investment recommendations. User-added data is persisted to Supabase once the project is configured. Row Level Security policies restrict each account to its own records.


## ChatGPT plugin integration

This branch also contains the hosted read-only MCP service used by the separate plugin repository. See [MCP-PLUGIN-INTEGRATION.md](MCP-PLUGIN-INTEGRATION.md) for the repository boundary, three tool names, validation commands, and endpoint setup. Keep the live MCP implementation in this repository and the plugin manifests/skills/package builder in `ezhilrean/stock-due-diligence` on `feature/sec-edgar-improvements`.
