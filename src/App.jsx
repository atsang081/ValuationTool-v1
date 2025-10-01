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
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-valuations`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch valuations');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
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
