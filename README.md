# Launch Console

A single-page Solana SPL token deployer. Static frontend (`public/index.html`) served by a tiny Express server (`server.js`) so Railway has something to run.

## Before you deploy anywhere

`PLATFORM_WALLET_ADDRESS` near the top of the `<script>` block in `public/index.html` is already set to your fee wallet. Fee payments get sent there, and the Review step also shows a QR code + copyable address for anyone who wants to pay manually. If you ever need to change wallets, edit that constant.

It also defaults to **devnet** (fake SOL, safe for testing). Switch the toggle to mainnet in the UI only once you've tested the full flow end to end — mainnet transactions are real and irreversible.

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
- Links out to Solscan, Birdeye, and Raydium's pool-creation page afterward

It does **not** simulate trading activity, generate fake volume, or provide any way to freeze/drain holder funds after the fact. That functionality was deliberately left out and won't be added to this codebase.
