import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'POST' && url.pathname === '/api/query') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const bodyText = Buffer.concat(chunks).toString();
      let payload;
      try {
        payload = JSON.parse(bodyText || '{}');
      } catch (parseError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        return;
      }

      const { prompt, providers = ['openai', 'gemini', 'anthropic'], config = {} } = payload;

      if (!prompt || typeof prompt !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      const tasks = providers.map((provider) => queryProvider(provider, prompt, config[provider] || {}));
      const results = await Promise.all(tasks);
      const responsePayload = results.reduce((acc, result) => ({ ...acc, [result.provider]: result }), {});

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompt, responses: responsePayload }));
      return;
    }

    if (req.method === 'GET') {
      await serveStatic(url.pathname, res);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (error) {
    console.error('Internal server error', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

async function serveStatic(requestPath, res) {
  let relativePath = requestPath === '/' ? '/index.html' : requestPath;
  const requestedFile = path.normalize(relativePath).replace(/^\.\.(\/|\\)/, '');
  const filePath = path.join(publicDir, requestedFile);

  try {
    const data = await fs.readFile(filePath);
    const contentType = getContentType(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } else {
      throw error;
    }
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function queryProvider(provider, prompt, providerConfig) {
  try {
    switch (provider) {
      case 'openai':
        return await queryOpenAI(prompt, providerConfig);
      case 'gemini':
        return await queryGemini(prompt, providerConfig);
      case 'anthropic':
        return await queryAnthropic(prompt, providerConfig);
      default:
        return {
          provider,
          status: 'unsupported',
          message: `Provider "${provider}" is not implemented`,
        };
    }
  } catch (error) {
    console.error(`Error querying ${provider}:`, error);
    return {
      provider,
      status: 'error',
      message: error.message || 'Unexpected error',
    };
  }
}

async function queryOpenAI(prompt, config) {
  const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      provider: 'openai',
      status: 'missing_credentials',
      message: 'OPENAI_API_KEY is not set',
    };
  }

  const requestBody = {
    model: config.model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant participating in a multi-model comparison.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content?.trim() || 'No response received.';

  return {
    provider: 'openai',
    status: 'success',
    message,
    raw: data,
  };
}

async function queryGemini(prompt, config) {
  const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: 'gemini',
      status: 'missing_credentials',
      message: 'GEMINI_API_KEY is not set',
    };
  }

  const model = config.model || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const message = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('\n')?.trim() || 'No response received.';

  return {
    provider: 'gemini',
    status: 'success',
    message,
    raw: data,
  };
}

async function queryAnthropic(prompt, config) {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      provider: 'anthropic',
      status: 'missing_credentials',
      message: 'ANTHROPIC_API_KEY is not set',
    };
  }

  const model = config.model || 'claude-3-haiku-20240307';

  const requestBody = {
    model,
    max_tokens: config.maxTokens || 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const message = data.content?.map((entry) => entry.text).join('\n')?.trim() || 'No response received.';

  return {
    provider: 'anthropic',
    status: 'success',
    message,
    raw: data,
  };
}

