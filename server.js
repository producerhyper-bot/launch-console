const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Set these in your Railway project's Variables tab (or export them locally
// before `npm start`). Neither endpoint below works without its key.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ---- AI: generate a token name, symbol, and description ----
app.post('/api/ai/name', async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: 'Server is missing ANTHROPIC_API_KEY.' });
  }
  const prompt = (req.body && req.body.prompt || '').trim();
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

// ---- AI: generate a token icon image ----
app.post('/api/ai/image', async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(400).json({ error: 'Server is missing OPENAI_API_KEY.' });
  }
  const prompt = (req.body && req.body.prompt || '').trim();
  const name = (req.body && req.body.name || '').trim();
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

// Single-page app — send index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Launch Console running on port ${PORT}`);
});
