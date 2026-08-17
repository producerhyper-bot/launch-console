# Launch Console

A single-page Solana SPL token deployer, mainnet-only. Static frontend (`public/index.html`) served by a small, hardened Express server (`server.js`).

## Configuration (no code edits needed)

Set these in Railway under **Settings → Variables** (or export them locally before `npm start`):

| Variable | Required | Default | What it does |
|---|---|---|---|
| `PLATFORM_WALLET_ADDRESS` | Recommended | the original demo wallet | Where deploy fees are sent. Change this to your own wallet before going live. |
| `SOLANA_RPC_ENDPOINT` | Recommended | public `api.mainnet-beta.solana.com` | The public mainnet RPC is heavily rate-limited under real traffic — use a paid provider (Helius, QuickNode, Triton, etc.) for production. |
| `ANTHROPIC_API_KEY` | Optional | — | Enables the AI name/description generator. |
| `OPENAI_API_KEY` | Optional | — | Enables the AI icon generator. |
| `VISIT_SALT` | Optional | random per boot | Salt used to hash visitor IPs for the visitor counter. Set a fixed value if you want the hash to stay stable across restarts. |

The frontend reads `PLATFORM_WALLET_ADDRESS` and `SOLANA_RPC_ENDPOINT` from a small `/api/config` endpoint at load time, so changing them is just a Railway variable change — no redeploy of `index.html` required.

**This app only runs on Solana Mainnet.** There is no devnet/testnet mode — every fee payment, mint, liquidity deposit, and sell is a real, irreversible on-chain transaction. Test carefully with small amounts.

## 1. Push to GitHub

```bash
cd launch-console          # this folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(Create the empty repo on GitHub first if you haven't — github.com/new.)

## 2. Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project → Deploy from GitHub repo** → pick the repo you just pushed.
3. Railway detects Node via `package.json` and Nixpacks automatically — `railway.json` is already set to run `npm start`.
4. In **Settings → Variables**, set `PLATFORM_WALLET_ADDRESS` and (recommended) `SOLANA_RPC_ENDPOINT` to your own values.
5. Once it builds, Railway gives you a public `*.up.railway.app` URL. That's your live site.
6. (Optional) In the Railway project settings, add a custom domain under **Settings → Domains**.

## Local testing

```bash
npm install
npm start
```

Visit `http://localhost:3000`. Remember: this hits real mainnet RPC and, if you connect a real wallet, real SOL.

## What this app does

- Connects a Phantom wallet
- Charges a configurable SOL fee (base + per-feature) to your platform wallet before deploying
- Mints a real SPL token on-chain (name, symbol, supply, decimals)
- Optionally revokes mint/freeze authority — real on-chain settings, not cosmetic
- Lets you generate a token name/description and a token icon with AI (see below)
- Lets you create a real Raydium liquidity pool and seed it with your token + SOL right after deploying
- Shows a real, server-backed count of people who've used the site
- Links out to Solscan, Birdeye, and Raydium's pool page afterward

It does **not** simulate trading activity, generate fake volume, provide any way to freeze/drain holder funds after the fact, or show a fabricated usage counter. None of that is in this codebase, and none of it will be added — those are the things that turn a legitimate deploy tool into a rug-pull kit, and this one is meant to stay legitimate.

If you (the deployer) hold a project's LP tokens because you funded the pool, you already control that liquidity through Raydium's own interface — nothing in this app needs to add a special "drain" button for that, and it deliberately doesn't.

## Visitor counter

The badge in the hero shows a real count of people who've loaded the page, backed by `server.js` and persisted to `data/stats.json`. It's deduped so one visitor refreshing repeatedly only counts once per day (via a salted, one-way hash of their IP — no raw IPs are stored). On Railway's default ephemeral filesystem this file resets on redeploy; attach a persistent volume or swap it for a real database if you want the count to survive deploys long-term.

## AI name & icon generation

Step 1 has a "Describe the coin idea" box with two buttons. Both call small backend
routes in `server.js` so your API keys never reach the browser, and both are
rate-limited (20 requests / 10 minutes per connection) to protect your API budget:

- **Generate name & description** → `POST /api/ai/name`, calls the Anthropic API
  (`claude-sonnet-4-6`). Requires `ANTHROPIC_API_KEY`.
- **Generate icon image** → `POST /api/ai/image`, calls OpenAI's image API
  (`gpt-image-1`). Requires `OPENAI_API_KEY`.

If a key is missing, that button shows an error instead of silently doing nothing. The
generated image is a preview only, same as an uploaded file — for it to actually show
up as on-chain metadata you still need to host it (Arweave, IPFS, Imgur) and paste the
URL into the "Hosted Image URL" field in Advanced Settings.

## Add initial liquidity

After a successful deploy, the result box gets a second section for creating a
Raydium CPMM pool and seeding it with your new token + SOL — no need to leave the
page. This uses `@raydium-io/raydium-sdk-v2`, loaded from a CDN at click-time, signed
with the same connected Phantom wallet.

Notes:
- This is a second, separate on-chain transaction from minting — you need the token
  amount *and* the SOL amount you enter, sitting in the connected wallet, plus roughly
  0.15–0.2 extra SOL for pool-creation rent/fees.
- The starting price is simply `SOL amount ÷ token amount`, so double-check both
  fields before signing — it's irreversible once the pool is created.
- `@raydium-io/raydium-sdk-v2` is pre-1.0 and occasionally changes shape between
  releases; if the "Create pool & add liquidity" button errors out after an SDK
  update, check [Raydium's TypeScript SDK docs](https://docs.raydium.io/sdk-api/typescript-sdk)
  for what changed.
- Test with small amounts before committing significant SOL — every action here is
  on mainnet and irreversible.

## Server hardening

`server.js` also includes, beyond the routes above:
- `helmet` for standard security headers
- `compression` for gzip'd responses
- `express-rate-limit` on the AI endpoints
- `trust proxy` enabled for correct client IPs behind Railway's proxy
- `GET /healthz` for uptime checks
