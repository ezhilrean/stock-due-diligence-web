# Stock Due Diligence Web

A responsive static stock research dashboard hosted with GitHub Pages. Built with HTML, CSS, and vanilla JavaScript; no build step or API key is required.

**Live website:** https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com/

## Features
- Investment overview and watchlist summary
- Searchable/filterable stock screener
- Five-year discounted cash-flow (DCF) calculator with sensitivity analysis
- Interactive due-diligence checklist
- Add-stock form and CSV watchlist export
- Responsive layout and light/dark theme

## Deploy to GitHub Pages
This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. Pushes to `main` trigger a deployment.

1. Open **Settings → Pages** in this repository.
2. Set the build and deployment source to **GitHub Actions**.
3. Wait for the workflow in the Actions tab to complete successfully.
4. The custom domain is configured through the `CNAME` file in the repository.

## Custom domain
The site uses `https://stock-due-diligence-web.chatgpt-plugin.public.mesprk.com/`. The DNS provider for `mesprk.com` must have a CNAME record for `stock-due-diligence-web.chatgpt-plugin.public` pointing to `ezhilrean.github.io`. Configure HTTPS in **Settings → Pages** once GitHub Pages verifies the domain.

## Important data note
The included stock prices, financial metrics, and quality scores are illustrative demo values, not live market data or investment recommendations. New stocks and checklist selections are stored only in the current page session and are not persisted to a database.
