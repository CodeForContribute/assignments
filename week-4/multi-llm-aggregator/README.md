# Polyglot Playground

A single-page React experience that lets you send the same prompt to multiple LLM providers (ChatGPT, Gemini, Claude) and compare their answers side-by-side. A lightweight Node proxy keeps your API keys off the client and normalizes responses.

## Features

- ✨ Sleek glassmorphism-inspired UI implemented with React and vanilla CSS
- 🔐 Optional API key inputs per provider – forwarded to the proxy only for the active request
- ⚡ Parallel requests to OpenAI, Google Gemini, and Anthropic Claude
- 🛡️ Graceful error messaging for missing credentials or upstream issues
- 📝 Ready-to-run Node server that serves the static bundle and proxies API calls

## Getting started

1. **Install dependencies** – the project uses only the Node standard library, so there is nothing to install.
2. **Configure provider keys** using environment variables or through the UI.

   ```bash
   export OPENAI_API_KEY=your-openai-key
   export GEMINI_API_KEY=your-google-gemini-key
   export ANTHROPIC_API_KEY=your-anthropic-key
   ```

   You can omit any variable if you plan to paste a key directly into the interface. Keys supplied via the UI are sent only to your proxy server.

3. **Run the development server**:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser, craft a prompt, toggle the providers you want, and click **Send prompt**.

## Project structure

```
multi-llm-aggregator/
├── public/
│   ├── app.jsx          # React components + client logic
│   ├── index.html       # Static entrypoint pulling React from CDNs
│   └── styles.css       # Custom styling for the application
├── server.js            # Node proxy + static file server
├── package.json         # Defines the start script
└── README.md            # Project overview and instructions
```

## Implementation notes

- The server is dependency-free, relying on the built-in `fetch` available in Node 18+.
- Responses are normalized into `{ provider, status, message, raw }` objects so the client can render consistent cards.
- Static files are served from the `public` directory; feel free to replace the CDN React links with a bundler pipeline if you prefer.
- Because browser-based requests to LLM APIs are typically blocked by CORS, routing through the Node proxy is the recommended production setup.

## Disclaimer

This project forwards your prompts and keys to third-party APIs (OpenAI, Google, Anthropic). Review their terms of service and pricing before use. Never commit or expose secret keys in a public repository.
