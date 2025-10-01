import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import * as cheerio from 'npm:cheerio@1.1.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ValuationRequest {
  address: string;
  sessionId: string;
}

interface ValuationResult {
  source: string;
  valuation_amount: number | null;
  status: string;
  error_message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { address, sessionId }: ValuationRequest = await req.json();

    if (!address || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Address and sessionId are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sources = [
      { name: '28Hse', url: 'https://www.28hse.com/en/valuation/' },
      { name: 'Bank of China (HK)', url: 'https://www.bochk.com/en/mortgage/expert/expert2.html' },
      { name: 'Hang Seng Bank', url: 'https://www.hangseng.com/en-hk/e-valuation/keyword-search/' },
      { name: 'HSBC', url: 'https://www.hsbc.com.hk/mortgages/tools/property-valuation/' },
      { name: 'Standard Chartered Bank', url: 'https://www.sc.com/hk/others/property-valuation.html' },
    ];

    const results: ValuationResult[] = [];

    for (const source of sources) {
      try {
        const valuation = await scrapeValuation(source.name, source.url, address);
        results.push(valuation);

        await supabase.from('valuations').insert({
          address,
          source: source.name,
          valuation_amount: valuation.valuation_amount,
          status: valuation.status,
          error_message: valuation.error_message,
          session_id: sessionId,
        });
      } catch (error) {
        const errorResult: ValuationResult = {
          source: source.name,
          valuation_amount: null,
          status: 'error',
          error_message: error.message || 'Unknown error',
        };
        results.push(errorResult);

        await supabase.from('valuations').insert({
          address,
          source: source.name,
          valuation_amount: null,
          status: 'error',
          error_message: error.message,
          session_id: sessionId,
        });
      }
    }

    const successfulValuations = results
      .filter((r) => r.status === 'success' && r.valuation_amount !== null)
      .map((r) => r.valuation_amount as number);

    const analytics = {
      highest: successfulValuations.length > 0 ? Math.max(...successfulValuations) : null,
      lowest: successfulValuations.length > 0 ? Math.min(...successfulValuations) : null,
      average:
        successfulValuations.length > 0
          ? successfulValuations.reduce((a, b) => a + b, 0) / successfulValuations.length
          : null,
    };

    return new Response(
      JSON.stringify({
        valuations: results,
        analytics,
        address,
        sessionId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function scrapeValuation(
  source: string,
  url: string,
  address: string
): Promise<ValuationResult> {
  const timeout = 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        source,
        valuation_amount: null,
        status: 'error',
        error_message: `HTTP ${response.status}`,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let valuation: number | null = null;

    switch (source) {
      case '28Hse':
        valuation = extractValuationGeneric($, ['valuation', 'price', 'value']);
        break;
      case 'Bank of China (HK)':
        valuation = extractValuationGeneric($, ['valuation', 'price', 'value']);
        break;
      case 'Hang Seng Bank':
        valuation = extractValuationGeneric($, ['valuation', 'price', 'value']);
        break;
      case 'HSBC':
        valuation = extractValuationGeneric($, ['valuation', 'price', 'value']);
        break;
      case 'Standard Chartered Bank':
        valuation = extractValuationGeneric($, ['valuation', 'price', 'value']);
        break;
      default:
        return {
          source,
          valuation_amount: null,
          status: 'not_available',
          error_message: 'Source not supported',
        };
    }

    if (valuation && valuation > 0) {
      return {
        source,
        valuation_amount: valuation,
        status: 'success',
      };
    } else {
      return {
        source,
        valuation_amount: null,
        status: 'not_available',
        error_message: 'Valuation data requires interactive form submission',
      };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return {
        source,
        valuation_amount: null,
        status: 'error',
        error_message: 'Request timeout',
      };
    }
    return {
      source,
      valuation_amount: null,
      status: 'error',
      error_message: error.message || 'Scraping failed',
    };
  }
}

function extractValuationGeneric($: cheerio.CheerioAPI, keywords: string[]): number | null {
  const text = $('body').text();

  for (const keyword of keywords) {
    const regex = new RegExp(
      `${keyword}[:\s]*HK\$?\s*([0-9,]+(?:\.[0-9]{1,2})?)`,
      'gi'
    );
    const match = regex.exec(text);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (value > 0) {
        return value;
      }
    }
  }

  const priceRegex = /HK\$\s*([0-9,]+(?:\.[0-9]{1,2})?)/gi;
  const matches = text.matchAll(priceRegex);
  for (const match of matches) {
    if (match[1]) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (value > 100000) {
        return value;
      }
    }
  }

  return null;
}
