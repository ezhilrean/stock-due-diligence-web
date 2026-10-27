import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

test("SEC lookup prioritizes exact ticker and exact company-name matches", () => {
  assert.match(source, /const exactTicker = rows\.filter\(\(r\) => r\.ticker === normalized\)/);
  assert.match(source, /const exactName = rows\.filter\(\(r\) => r\.title\.trim\(\)\.toUpperCase\(\) === normalized\)/);
  assert.match(source, /: rows\.filter\(\(r\) => r\.title\.toUpperCase\(\)\.includes\(normalized\)\)\.slice\(0, 10\)/);
});

test("financial facts handle common revenue concept aliases and disclose the chosen tag", () => {
  assert.match(source, /RevenueFromContractWithCustomerExcludingAssessedTax/);
  assert.match(source, /SalesRevenueNet/);
  assert.match(source, /Revenues/);
  assert.match(source, /requestedConcept: concept/);
  assert.match(source, /reportedConcept: resolvedConcept/);
});

test("all MCP tools declare safety annotations", () => {
  assert.equal((source.match(/readOnlyHint: true/g) || []).length, 3);
  assert.equal((source.match(/destructiveHint: false/g) || []).length, 3);
  assert.equal((source.match(/openWorldHint: (?:true|false)/g) || []).length, 3);
});

test("financial outputs include authoritative SEC source and limitations", () => {
  assert.match(source, /https:\/\/www\.sec\.gov\/files\/company_tickers\.json/);
  assert.match(source, /api\/xbrl\/companyfacts\/CIK/);
  assert.match(source, /Verify values, units, segment context, and accounting presentation/);
});

test("checklist separates research framework from verified company findings", () => {
  assert.match(source, /research framework, not a company-specific finding/);
  assert.match(source, /Do not state an allegation as an established fact/);
});

test("server has no brokerage execution tool", () => {
  assert.doesNotMatch(source, /server\.tool\(\s*["'](?:buy_stock|place_order|execute_trade)["']/);
});
