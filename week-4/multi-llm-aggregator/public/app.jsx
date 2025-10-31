const PROVIDERS = [
  {
    id: 'openai',
    label: 'ChatGPT',
    tagline: 'OpenAI GPT models with nuanced reasoning',
    accent: '#7f5af0',
    placeholder: 'sk-...',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    tagline: 'Google DeepMind multi-modal powerhouse',
    accent: '#4ade80',
    placeholder: 'AIzaSy...',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    tagline: 'Anthropic focus on constitutional safety',
    accent: '#38bdf8',
    placeholder: 'sk-ant-...',
  },
];

const StatusChip = ({ status }) => {
  const normalized = status || 'pending';
  const label = normalized.replace(/_/g, ' ');
  return <span className={`status-chip status-${normalized}`}>{label}</span>;
};

const ProviderToggle = ({ provider, enabled, onToggle, apiKey, onApiKeyChange }) => (
  <div className={`provider-card ${enabled ? 'active' : ''}`}>
    <div className="provider-header">
      <div>
        <div className="provider-name">{provider.label}</div>
        <div className="provider-description">{provider.tagline}</div>
      </div>
      <div className={`toggle ${enabled ? 'active' : ''}`} onClick={() => onToggle(provider.id)}></div>
    </div>
    <div>
      <label className="prompt-label" htmlFor={`${provider.id}-key`}>
        API key (optional)
      </label>
      <input
        id={`${provider.id}-key`}
        type="password"
        value={apiKey || ''}
        onChange={(event) => onApiKeyChange(provider.id, event.target.value)}
        placeholder={provider.placeholder}
        className="key-input"
        autoComplete="off"
      />
    </div>
  </div>
);

const ResultCard = ({ provider, result }) => {
  if (!result) {
    return (
      <div className="result-card">
        <div className="result-header">
          <h3>{provider.label}</h3>
          <span className="status-chip">Pending</span>
        </div>
        <p className="result-message">No response yet.</p>
      </div>
    );
  }

  return (
    <div className="result-card">
      <div className="result-header">
        <h3>{provider.label}</h3>
        <StatusChip status={result.status} />
      </div>
      <p className="result-message">{result.message}</p>
    </div>
  );
};

const Loader = () => (
  <div className="loader" role="status" aria-label="Loading"></div>
);

const App = () => {
  const [prompt, setPrompt] = React.useState('Explain quantum entanglement like I am a five year old.');
  const [enabledProviders, setEnabledProviders] = React.useState(() => new Set(PROVIDERS.map((p) => p.id)));
  const [apiKeys, setApiKeys] = React.useState({});
  const [results, setResults] = React.useState({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const toggleProvider = (providerId) => {
    setEnabledProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const handleApiKeyChange = (providerId, value) => {
    setApiKeys((prev) => ({ ...prev, [providerId]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setResults({});

    const selectedProviders = PROVIDERS.filter((provider) => enabledProviders.has(provider.id)).map((p) => p.id);

    if (!prompt.trim()) {
      setError('Please provide a prompt before querying the models.');
      setIsLoading(false);
      return;
    }

    if (selectedProviders.length === 0) {
      setError('Select at least one model provider to compare responses.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          providers: selectedProviders,
          config: Object.fromEntries(
            selectedProviders.map((id) => [id, apiKeys[id] ? { apiKey: apiKeys[id] } : {}])
          ),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Unable to fetch responses.');
      }

      const payload = await response.json();
      setResults(payload.responses || {});
    } catch (requestError) {
      console.error(requestError);
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="header">
          <div className="badge">Polyglot Playground</div>
          <h1 className="hero-title">Compare top AI models side-by-side.</h1>
          <p className="hero-subtitle">
            Enter a prompt once and watch ChatGPT, Gemini, and Claude respond simultaneously. Perfect for research,
            evaluations, and prompt engineering experiments.
          </p>
        </header>

        <form className="prompt-card" onSubmit={handleSubmit}>
          <label htmlFor="prompt" className="prompt-label">
            Prompt
          </label>
          <textarea
            id="prompt"
            className="prompt-textarea"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask anything..."
          ></textarea>

          <section>
            <h2 className="prompt-label" style={{ marginBottom: '12px', fontSize: '14px', textTransform: 'uppercase' }}>
              Providers
            </h2>
            <div className="provider-grid">
              {PROVIDERS.map((provider) => (
                <ProviderToggle
                  key={provider.id}
                  provider={provider}
                  enabled={enabledProviders.has(provider.id)}
                  onToggle={toggleProvider}
                  apiKey={apiKeys[provider.id]}
                  onApiKeyChange={handleApiKeyChange}
                />
              ))}
            </div>
          </section>

          <div className="submit-row">
            {error && <div className="status-chip status-error" role="alert">{error}</div>}
            <div className="action-row">
              <button className="primary-button" type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader />
                    Querying models...
                  </>
                ) : (
                  <>
                    <span>Send prompt</span>
                    <span aria-hidden>→</span>
                  </>
                )}
              </button>
              <span className="meta-info">Keys stay on this device and are only used for this request.</span>
            </div>
          </div>
        </form>

        <section className="results-grid" aria-live="polite">
          {PROVIDERS.filter((provider) => enabledProviders.has(provider.id)).map((provider) => (
            <ResultCard key={provider.id} provider={provider} result={results[provider.id]} />
          ))}
          {enabledProviders.size === 0 && <p className="meta-info">Activate at least one provider to see results.</p>}
        </section>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
