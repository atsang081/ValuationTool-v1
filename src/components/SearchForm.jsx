import React, { useState } from 'react';
import './SearchForm.css';

function SearchForm({ onSearch, loading }) {
  const [address, setAddress] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (address.trim()) {
      onSearch(address.trim());
    }
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Enter Hong Kong property address (e.g., Flat A, 1/F, Block 1, 123 Main Street, Kowloon)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="search-button"
          disabled={loading || !address.trim()}
        >
          {loading ? (
            <>
              <span className="spinner"></span>
              Searching...
            </>
          ) : (
            'Get Valuations'
          )}
        </button>
      </div>
    </form>
  );
}

export default SearchForm;
