# Stock Due Diligence Web

A responsive, static stock research dashboard for Vercel. Built with HTML, CSS, and vanilla JavaScript; no build step or API key is required.

## Features
- Investment overview and watchlist summary
- Searchable/filterable stock screener
- Five-year discounted cash-flow (DCF) calculator with sensitivity analysis
- Interactive due-diligence checklist
- Add-stock form and CSV watchlist export
- Responsive layout and light/dark theme

## Deploy to Vercel
1. Import this GitHub repository into Vercel.
2. Keep the Framework Preset as **Other** (or Static HTML if offered).
3. Leave the build command and output directory empty/default; the site entry point is `index.html`.
4. Deploy.

## Important data note
The included stock prices, financial metrics, and quality scores are illustrative demo values, not live market data or investment recommendations. New stocks and checklist selections are stored only in the current page session and are not persisted to a database.

## Domain
After deployment, add your domain in Vercel → Project Settings → Domains, then configure only the DNS records Vercel displays at your domain DNS provider. Preserve any existing email-related DNS records.
