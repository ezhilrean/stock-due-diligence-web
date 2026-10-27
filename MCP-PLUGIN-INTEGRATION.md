# Plugin and MCP repository responsibilities

This repository is the source of truth for the website and the hosted read-only MCP service on the `feature/mcp-server` branch. The ChatGPT plugin package is maintained separately in [`ezhilrean/stock-due-diligence`](https://github.com/ezhilrean/stock-due-diligence/tree/feature/sec-edgar-improvements).

## Runtime boundary

The plugin root `mcp.json` points to the public HTTPS endpoint:

`https://mcp.stock-due-diligence.chatgpt-plugin.developer.mesprk.com/mcp`

The plugin ZIP contains the remote MCP connection settings and test scenarios; it does not need to duplicate the website source or deployed server implementation. All website and server source stays in this repository. Excluding website/server source from the plugin upload ZIP does not delete it from GitHub or remove the deployed server features.

## MCP tools exposed

- `search_sec_company`: resolves US public-company tickers/names to SEC identifiers.
- `get_sec_company_facts`: retrieves reported SEC company facts with units, periods, filing metadata and limitations.
- `due_diligence_checklist`: generates a research checklist and source guidance; it does not claim the checklist has been completed.

These are read-only research capabilities. The server must not expose trade placement or brokerage execution tools.

## Validate changes before deploying

From the `mcp-server` directory on this branch:

```sh
npm install
npm run check
npm test
```

Set `SEC_USER_AGENT` to an identifying app name and a real monitored contact email in the host environment. Keep `OPENAI_APPS_CHALLENGE` in the host environment; never commit the challenge token or credentials.

After deployment, verify `/health`, confirm the domain challenge responds with the exact plain-text token, connect to the HTTPS `/mcp` endpoint, inspect MCP tool discovery, and run representative positive and negative tests. A GitHub commit alone does not prove deployment or Developer Portal approval.

## Branch ownership

- Website and hosted MCP implementation: [`feature/mcp-server`](https://github.com/ezhilrean/stock-due-diligence-web/tree/feature/mcp-server)
- ChatGPT plugin manifests, skills, references, and upload packaging: [`feature/sec-edgar-improvements`](https://github.com/ezhilrean/stock-due-diligence/tree/feature/sec-edgar-improvements)

Keep these branches separate. Do not merge either branch into `main` unless explicitly requested.
