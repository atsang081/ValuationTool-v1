import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import SearchForm from './components/SearchForm';
import ResultsDisplay from './components/ResultsDisplay';
import './App.css';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (address) => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration is missing. Please check your environment variables.');
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const apiUrl = `${supabaseUrl}/functions/v1/scrape-valuations`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, sessionId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch valuations';

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status}): ${errorText || response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Valuation fetch error:', err);

      let userMessage = err.message;

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        userMessage = 'Unable to connect to the valuation service. This could be due to:\n• Network connectivity issues\n• Invalid Supabase configuration\n• CORS restrictions\n\nPlease check your internet connection and Supabase setup.';
      }

      setError(userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>HK Property Valuation Aggregator</h1>
          <p>Get property valuations from multiple Hong Kong banks instantly</p>
        </header>

        <SearchForm onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {results && <ResultsDisplay results={results} />}
      </div>
    </div>
  );
}

export default App;
