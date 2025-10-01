import React from 'react';
import './ResultsDisplay.css';

function ResultsDisplay({ results }) {
  const { valuations, analytics } = results;

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return `HK$${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const bankLogos = {
    '28Hse': '🏢',
    'Bank of China (HK)': '🏦',
    'Hang Seng Bank': '🏦',
    'HSBC': '🏦',
    'Standard Chartered Bank': '🏦',
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return '#48bb78';
      case 'error':
        return '#f56565';
      case 'not_available':
        return '#ed8936';
      default:
        return '#cbd5e0';
    }
  };

  return (
    <div className="results-display">
      <div className="analytics-section">
        <h2>Valuation Analytics</h2>
        <div className="analytics-grid">
          <div className="analytics-card highest">
            <div className="card-icon">📈</div>
            <div className="card-content">
              <div className="card-label">Highest Valuation</div>
              <div className="card-value">{formatCurrency(analytics.highest)}</div>
            </div>
          </div>
          <div className="analytics-card lowest">
            <div className="card-icon">📉</div>
            <div className="card-content">
              <div className="card-label">Lowest Valuation</div>
              <div className="card-value">{formatCurrency(analytics.lowest)}</div>
            </div>
          </div>
          <div className="analytics-card average">
            <div className="card-icon">📊</div>
            <div className="card-content">
              <div className="card-label">Average Valuation</div>
              <div className="card-value">{formatCurrency(analytics.average)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="valuations-section">
        <h2>Individual Bank Valuations</h2>
        <div className="valuations-grid">
          {valuations.map((valuation, index) => (
            <div
              key={index}
              className={`valuation-card ${valuation.status}`}
            >
              <div className="valuation-header">
                <div className="bank-logo">{bankLogos[valuation.source] || '🏦'}</div>
                <div className="bank-name">{valuation.source}</div>
              </div>
              <div className="valuation-body">
                {valuation.status === 'success' ? (
                  <div className="valuation-amount">
                    {formatCurrency(valuation.valuation_amount)}
                  </div>
                ) : (
                  <div className="valuation-error">
                    <div className="error-status">
                      {valuation.status === 'not_available' ? 'Not Available' : 'Error'}
                    </div>
                    {valuation.error_message && (
                      <div className="error-details">{valuation.error_message}</div>
                    )}
                  </div>
                )}
              </div>
              <div className="valuation-footer">
                <div
                  className="status-indicator"
                  style={{ backgroundColor: getStatusColor(valuation.status) }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ResultsDisplay;
