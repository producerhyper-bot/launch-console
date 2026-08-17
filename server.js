const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway (and most PaaS hosts) sit behind a reverse proxy - trust it so
// req.ip and the rate limiter see the real client IP instead of the proxy's.
app.set('trust proxy', 1);

app.use(compression());
app.use(helmet({
  // Disabled so the page can load Google Fonts, esm.sh module imports,
  // Phantom's injected script, DexScreener's embed iframe, and the
  // AI-generated data: URLs for icons - a strict default CSP would break all of these.
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PLATFORM_WALLET_ADDRESS = process.env.PLATFORM_WALLET_ADDRESS || 'HQ7Fp1W1AjkBF5j6pQMKHfTPRUZxqVr72cPNs5cYDz3D';
const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({
    platformWallet: PLATFORM_WALLET_ADDRESS,
    rpcEndpoint: SOLANA_RPC_ENDPOINT,
  });
});
app.get('/api/ai/status', (req, res) => {
  res.json({ name: Boolean(ANTHROPIC_API_KEY), image: Boolean(OPENAI_API_KEY) });
});

const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests from this connection - try again in a few minutes.' },
});
app.use('/api/ai/name', aiLimiter);
app.use('/api/ai/image', aiLimiter);

app.post('/api/ai/name', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
  }
  const prompt = (req.body && req.body.prompt || '').trim().slice(0, 500);
  if (!prompt) return res.status(400).json({ error: 'Describe the coin idea first.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You're naming a memecoin. Idea: "${prompt}".\n` +
            `Reply with ONLY minified JSON, no markdown fences, no commentary, in exactly this shape:\n` +
            `{"name":"<catchy token name, max 32 chars>","symbol":"<3-6 letter uppercase ticker>","description":"<one punchy sentence, max 140 chars>"}`,
        }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data && data.error && data.error.message) || 'Anthropic API error');
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    const cleaned = text.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    console.error('AI name generation failed:', err);
    res.status(500).json({ error: 'Could not generate a name right now.' });
  }
});

app.post('/api/ai/image', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(400).json({ error: 'Server is missing OPENAI_API_KEY.' });
  }
  const prompt = (req.body && req.body.prompt || '').trim().slice(0, 500);
  const name = (req.body && req.body.name || '').trim().slice(0, 64);
  if (!prompt) return res.status(400).json({ error: 'Describe the coin idea first.' });

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: `A simple, bold, flat-color circular mascot/logo icon for a memecoin` +
          `${name ? ` called "${name}"` : ''}. Idea: ${prompt}. Centered subject, no text, ` +
          `no watermark, vibrant colors, clean crypto-app-icon style, plain background.`,
        size: '1024x1024',
        n: 1,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error((data && data.error && data.error.message) || 'OpenAI API error');
    const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) throw new Error('No image returned');
    res.json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error('AI image generation failed:', err);
    res.status(500).json({ error: 'Could not generate an image right now.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Launch Console (mainnet) running on port ${PORT}`);
  if (PLATFORM_WALLET_ADDRESS === 'HQ7Fp1W1AjkBF5j6pQMKHfTPRUZxqVr72cPNs5cYDz3D') {
    console.warn('Using the default PLATFORM_WALLET_ADDRESS - set your own via the PLATFORM_WALLET_ADDRESS env var before accepting real fees.');
  }
  if (SOLANA_RPC_ENDPOINT.includes('api.mainnet-beta.solana.com')) {
    console.warn('Using the public mainnet-beta RPC endpoint, which rate-limits heavily under real traffic - set SOLANA_RPC_ENDPOINT to a paid provider for production use.');
  }
});
