/*
  # Property Valuations Schema

  ## Overview
  Creates the database structure for storing property valuation data from multiple bank sources.

  ## New Tables

  ### `valuations`
  Stores individual valuation results from each bank source for a given property address.
  
  - `id` (uuid, primary key) - Unique identifier for each valuation record
  - `address` (text) - The Hong Kong property address being valued
  - `source` (text) - The bank or service name (e.g., "28Hse", "HSBC", "Bank of China")
  - `valuation_amount` (numeric) - The property valuation in HKD
  - `status` (text) - Status of the valuation fetch ("success", "error", "not_available")
  - `error_message` (text, nullable) - Error details if the valuation fetch failed
  - `created_at` (timestamptz) - Timestamp when the record was created
  - `session_id` (text) - Groups valuations from the same search session

  ## Indexes
  - Index on `address` for faster lookups by property address
  - Index on `session_id` for retrieving all valuations from a single search
  - Index on `created_at` for time-based queries and cleanup

  ## Security
  - Enable Row Level Security (RLS) on the `valuations` table
  - Allow public read access for all users (no authentication required)
  - Allow public insert access for creating new valuation records
  - This is a public tool with no user authentication

  ## Notes
  - Session data is temporary and can be cleared after 24 hours
  - No personal data is stored beyond the search session
*/

CREATE TABLE IF NOT EXISTS valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  source text NOT NULL,
  valuation_amount numeric,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT now(),
  session_id text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_valuations_address ON valuations(address);
CREATE INDEX IF NOT EXISTS idx_valuations_session ON valuations(session_id);
CREATE INDEX IF NOT EXISTS idx_valuations_created ON valuations(created_at);

ALTER TABLE valuations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON valuations;
CREATE POLICY "Allow public read access"
  ON valuations
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON valuations;
CREATE POLICY "Allow public insert access"
  ON valuations
  FOR INSERT
  TO anon
  WITH CHECK (true);
