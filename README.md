# Launch Console

A single-page Solana SPL token deployer. Static frontend (`public/index.html`) served by a tiny Express server (`server.js`) so Railway has something to run.

## Before you deploy anywhere

`PLATFORM_WALLET_ADDRESS` near the top of the `<script>` block in `public/index.html` is already set to your fee wallet (`HQ7Fp1W1AjkBF5j6pQMKHfTPRUZxqVr72cPNs5cYDz3D`). Fee payments get sent there, and the Review step also shows a QR code + copyable address for anyone who wants to pay manually. If you ever need to change wallets, edit that constant.

It also defaults to **devnet** (fake SOL, safe for testing) — there's now an actual Devnet / Mainnet toggle near the top of the page (it drives the RPC endpoint, the banner, the Review step, and the Raydium program IDs all at once). Only switch it to mainnet once you've tested the full flow end to end — mainnet transactions are real and irreversible.

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
3. Railway detects Node via `package.json` and Nixpacks automatically — no config needed, `railway.json` is already set to run `npm start`.
4. Once it builds, Railway gives you a public `*.up.railway.app` URL. That's your live site.
5. (Optional) In the Railway project settings, add a custom domain under **Settings → Domains**.

## Local testing

```bash
npm install
npm start
```

Visit `http://localhost:3000`.

## What this app does

- Connects a Phantom wallet
- Charges a configurable SOL fee (base + per-feature) to your wallet before deploying
- Mints a real SPL token on-chain (name, symbol, supply, decimals)
- Optionally revokes mint/freeze authority — real on-chain settings, not cosmetic
- Lets you generate a token name/description and a token icon with AI (see below)
- Lets you create a real Raydium liquidity pool and seed it with your token + SOL right after deploying
- Links out to Solscan, Birdeye, and Raydium's pool page afterward

It does **not** simulate trading activity, generate fake volume, or provide any way to freeze/drain holder funds after the fact. That functionality was deliberately left out and won't be added to this codebase.

## AI name & icon generation

Step 1 has a "Describe the coin idea" box with two buttons. Both call small backend
routes in `server.js` so your API keys never reach the browser:

- **Generate name & description** → `POST /api/ai/name`, calls the Anthropic API
  (`claude-sonnet-4-6`). Requires `ANTHROPIC_API_KEY`.
- **Generate icon image** → `POST /api/ai/image`, calls OpenAI's image API
  (`gpt-image-1`). Requires `OPENAI_API_KEY`.

Set these in Railway under **Settings → Variables** (or export them locally before
`npm start`). If a key is missing, that button shows an error instead of silently
doing nothing. The generated image is a preview only, same as an uploaded file — for
it to actually show up as on-chain metadata you still need to host it (Arweave, IPFS,
Imgur) and paste the URL into the "Hosted Image URL" field in Advanced Settings.

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
- Test the whole flow on devnet with small amounts before ever touching mainnet.
