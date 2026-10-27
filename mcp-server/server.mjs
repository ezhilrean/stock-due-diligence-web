import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT || 3000);
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || "";
const SEC_BASE = "https://www.sec.gov";
const DATA_BASE = "https://data.sec.gov";
const TOOL_RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE || 30);
const ipBuckets = new Map();

app.use((req, res, next) => {
  if (req.path !== "/mcp") return next();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = ipBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start >= 60_000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  ipBuckets.set(key, bucket);
  if (bucket.count > TOOL_RATE_LIMIT) {
    return res.status(429).json({ error: "Rate limit exceeded. Try again shortly." });
  }
  next();
});

app.get("/", (_req, res) => {
  res.json({
    name: "Stock Due Diligence MCP Server",
    status: "ok",
    transport: "MCP Streamable HTTP",
    endpoint: "/mcp",
    note: "Read-only research tools. SEC data access requires SEC_USER_AGENT to be configured."
  });
});
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// OpenAI Apps domain verification challenge. Store the token only in the host's
// environment variables (OPENAI_APPS_CHALLENGE); never commit the token itself.
app.get("/.well-known/openai-apps-challenge", (_req, res) => {
  const challenge = process.env.OPENAI_APPS_CHALLENGE;
  if (!challenge) {
    return res.status(503).type("text/plain").send("OPENAI_APPS_CHALLENGE is not configured.\\n");
  }
  return res.status(200).type("text/plain").send(challenge);
});

async function secFetch(url) {
  if (!SEC_USER_AGENT) {
    throw new Error("SEC data tools are not configured yet. Set SEC_USER_AGENT to an identifying application name and contact email.");
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate"
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error("SEC did not find data for that company identifier.");
    if (response.status === 429) throw new Error("SEC rate limit reached. Wait and retry.");
    throw new Error(`SEC request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

let tickerCache = { expiresAt: 0, rows: [] };
async function getTickerRows() {
  if (tickerCache.expiresAt > Date.now()) return tickerCache.rows;
  const data = await secFetch(`${SEC_BASE}/files/company_tickers.json`);
  const rows = Object.values(data).map((row) => ({
    cik: String(row.cik_str).padStart(10, "0"),
    ticker: String(row.ticker || "").toUpperCase(),
    title: String(row.title || "")
  }));
  tickerCache = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, rows };
  return rows;
}

const serverInfo = {
  name: "stock-due-diligence",
  version: "0.1.0"
};

function buildServer() {
  const server = new McpServer(serverInfo);

  server.tool(
    "search_sec_company",
    "Find a US public company by ticker symbol or company name using the SEC's public company ticker list. Returns SEC CIK and matched identifiers, not investment advice.",
    { query: z.string().min(1).max(100).describe("Company ticker or name, e.g. AAPL or Apple") },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ query }) => {
      try {
        const rows = await getTickerRows();
        const q = query.trim().toUpperCase();
        const exact = rows.filter((r) => r.ticker === q);
        const matches = exact.length ? exact : rows.filter((r) =>
          r.title.toUpperCase().includes(q) || r.ticker.includes(q)
        ).slice(0, 10);
        return { content: [{ type: "text", text: JSON.stringify({
          query,
          matches,
          source: "SEC company_tickers.json",
          sourceUrl: "https://www.sec.gov/files/company_tickers.json",
          note: "Confirm the legal entity and ticker before relying on any filing data."
        }, null, 2) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error.message }] };
      }
    }
  );

  server.tool(
    "get_sec_company_facts",
    "Retrieve reported annual company facts from the SEC Company Facts API for a US registrant. Provides reported values and filing metadata; it does not calculate a valuation or recommend a security.",
    {
      cik: z.string().regex(/^\d{1,10}$/).describe("SEC Central Index Key (CIK), digits only"),
      concepts: z.array(z.enum([
        "Revenue", "NetIncomeLoss", "Assets", "Liabilities", "StockholdersEquity",
        "OperatingIncomeLoss", "EarningsPerShareBasic", "CashAndCashEquivalentsAtCarryingValue",
        "LongTermDebtCurrent", "LongTermDebtNoncurrent", "NetCashProvidedByUsedInOperatingActivities"
      ])).max(11).optional().describe("Optional list of common US-GAAP concepts; defaults to core financial metrics")
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    async ({ cik, concepts }) => {
      try {
        const paddedCik = cik.padStart(10, "0");
        const data = await secFetch(`${DATA_BASE}/api/xbrl/companyfacts/CIK${paddedCik}.json`);
        const requested = concepts?.length ? concepts : [
          "Revenue", "NetIncomeLoss", "Assets", "Liabilities", "StockholdersEquity",
          "OperatingIncomeLoss", "EarningsPerShareBasic",
          "CashAndCashEquivalentsAtCarryingValue", "LongTermDebtCurrent",
          "LongTermDebtNoncurrent", "NetCashProvidedByUsedInOperatingActivities"
        ];
        const output = {};
        for (const concept of requested) {
          const fact = data.facts?.["us-gaap"]?.[concept];
          if (!fact) {
            output[concept] = { available: false, note: "Concept not present in the company's SEC company-facts payload." };
            continue;
          }
          const units = fact.units || {};
          const unitEntries = Object.entries(units);
          output[concept] = {
            label: fact.label,
            description: fact.description,
            units: Object.fromEntries(unitEntries.map(([unit, entries]) => {
              const annual = entries.filter((entry) =>
                entry.form === "10-K" &&
                entry.fy &&
                entry.fp === "FY" &&
                entry.end &&
                (!entry.start || (new Date(entry.end) - new Date(entry.start)) >= 300 * 24 * 60 * 60 * 1000)
              ).sort((a, b) => String(b.end).localeCompare(String(a.end)));
              const byYear = new Map();
              for (const entry of annual) {
                const year = String(entry.fy);
                if (!byYear.has(year)) byYear.set(year, {
                  fiscalYear: entry.fy,
                  periodEnd: entry.end,
                  value: entry.val,
                  unit,
                  form: entry.form,
                  filed: entry.filed,
                  accessionNumber: entry.accn
                });
              }
              return [unit, [...byYear.values()].slice(0, 5).reverse()];
            }))
          };
        }
        return { content: [{ type: "text", text: JSON.stringify({
          company: data.entityName,
          cik: paddedCik,
          facts: output,
          source: `${DATA_BASE}/api/xbrl/companyfacts/CIK${paddedCik}.json`,
          limitations: [
            "SEC company facts are reported data, not necessarily normalized for comparability.",
            "Metric availability and fiscal-year presentation vary by issuer.",
            "Verify values and context in the original 10-K/10-Q before relying on them."
          ]
        }, null, 2) }] };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error.message }] };
      }
    }
  );

  server.tool(
    "due_diligence_checklist",
    "Generate a structured research checklist for a publicly traded company. This is a research framework, not a company-specific finding or investment recommendation.",
    {
      company: z.string().min(1).max(160).describe("Company name and/or ticker"),
      market: z.enum(["US", "India", "Other", "Unknown"]).default("Unknown"),
      focus: z.enum(["full", "financials", "governance", "fraud_and_legal", "valuation", "cybersecurity"]).default("full")
    },
    { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    async ({ company, market, focus }) => {
      const sections = {
        financials: [
          "Reconcile revenue, operating profit, net income, cash flow, and balance-sheet trends across at least five years.",
          "Review working capital, cash conversion, debt maturities, interest coverage, liquidity, and off-balance-sheet obligations.",
          "Check accounting policy changes, restatements, auditor opinions, related-party transactions, and unusual accruals."
        ],
        governance: [
          "Review board independence, management incentives, ownership concentration, promoter/insider transactions, and succession.",
          "Inspect auditor tenure, resignations, qualified opinions, internal-control weaknesses, and disclosure quality.",
          "Compare management statements with filings, capital allocation, and subsequent reported outcomes."
        ],
        fraud_and_legal: [
          "Search official regulator enforcement releases, court records, litigation disclosures, and material contingent liabilities.",
          "Separate allegations, investigations, charges, settlements, and adjudicated findings; cite dates and primary sources.",
          "Look for unexplained related-party flows, inconsistent disclosures, unusual receivables, and unexplained auditor changes."
        ],
        valuation: [
          "State assumptions explicitly for growth, margins, reinvestment, discount rate, terminal value, and dilution.",
          "Compare valuation with peers and the company's own history using comparable accounting definitions.",
          "Run downside and reverse-valuation scenarios; do not present point estimates as certainty."
        ],
        cybersecurity: [
          "Review disclosed cyber incidents, material weaknesses, privacy/regulatory actions, and risk-factor changes.",
          "Distinguish company disclosures from third-party allegations and unverified reports.",
          "Assess business continuity, concentration risks, and dependencies disclosed in filings."
        ],
        business: [
          "Explain products, customers, competitive advantage, industry structure, cyclicality, and key dependencies.",
          "Assess revenue concentration, pricing power, customer retention, supply-chain exposure, and operating leverage.",
          "Identify thesis-breaking risks, contrary evidence, and questions that require further investigation."
        ]
      };
      const selected = focus === "full" ? Object.keys(sections) : ({
        financials: ["financials", "business"],
        governance: ["governance"],
        fraud_and_legal: ["fraud_and_legal", "governance"],
        valuation: ["valuation", "financials"],
        cybersecurity: ["cybersecurity", "fraud_and_legal"]
      })[focus];
      const checklist = selected.map((key) => ({ area: key, questions: sections[key] }));
      return { content: [{ type: "text", text: JSON.stringify({
        company, market, focus, checklist,
        sourceGuidance: market === "US"
          ? ["SEC EDGAR company filings", "SEC enforcement releases", "Issuer investor-relations materials"]
          : market === "India"
            ? ["NSE/BSE official filings and announcements", "SEBI orders and releases", "Issuer investor-relations materials"]
            : ["Official exchange filings", "Relevant securities regulator releases", "Issuer investor-relations materials"],
        outputStandard: "Record each material claim with source, publication date, relevant period, confidence, and unresolved questions. Do not state an allegation as an established fact.",
        disclaimer: "Research support only; not personalized investment advice. Independently verify all material claims against authoritative sources."
      }, null, 2) }] };
    }
  );

  return server;
}

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => { void transport.close(); void server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed:", error?.message || error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed." });
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST, DELETE").json({ error: "Use MCP Streamable HTTP POST requests." });
});
app.delete("/mcp", (_req, res) => res.status(405).set("Allow", "POST").json({ error: "This server is stateless; no session to delete." }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stock Due Diligence MCP server listening on port ${PORT}`);
});
