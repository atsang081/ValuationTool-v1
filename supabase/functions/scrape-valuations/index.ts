import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

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

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (!perplexityApiKey) {
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const sources = [
      'HSBC Hong Kong',
      'Hang Seng Bank',
      'Bank of China (Hong Kong)',
      'Standard Chartered Hong Kong',
      'Centaline Property',
    ];

    const results: ValuationResult[] = [];

    for (const source of sources) {
      try {
        const valuation = await getValuationFromPerplexity(source, address, perplexityApiKey);
        results.push(valuation);

        await supabase.from('valuations').insert({
          address,
          source: source,
          valuation_amount: valuation.valuation_amount,
          status: valuation.status,
          error_message: valuation.error_message,
          session_id: sessionId,
        });
      } catch (error) {
        const errorResult: ValuationResult = {
          source: source,
          valuation_amount: null,
          status: 'error',
          error_message: error.message || 'Unknown error',
        };
        results.push(errorResult);

        await supabase.from('valuations').insert({
          address,
          source: source,
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

async function getValuationFromPerplexity(
  source: string,
  address: string,
  apiKey: string
): Promise<ValuationResult> {
  const prompt = `What is the current property valuation estimate from ${source} for the property at "${address}" in Hong Kong? Please provide only the numerical value in Hong Kong Dollars (HKD). If you find a valuation, respond with just the number without currency symbols or commas. If no valuation is available, respond with "NOT_AVAILABLE". Focus on getting the most recent valuation data from ${source}'s property valuation service or mortgage calculator.`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'You are a property valuation assistant. Provide only numerical values or "NOT_AVAILABLE". Do not include explanations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return {
        source,
        valuation_amount: null,
        status: 'error',
        error_message: 'Empty response from API',
      };
    }

    if (content.toUpperCase().includes('NOT_AVAILABLE') || content.toUpperCase().includes('NOT AVAILABLE')) {
      return {
        source,
        valuation_amount: null,
        status: 'not_available',
        error_message: 'No valuation data available from this source',
      };
    }

    const numberMatch = content.match(/[\d,]+(?:\.\d+)?/);
    if (numberMatch) {
      const value = parseFloat(numberMatch[0].replace(/,/g, ''));
      if (value > 0 && value < 1000000000) {
        return {
          source,
          valuation_amount: value,
          status: 'success',
        };
      }
    }

    return {
      source,
      valuation_amount: null,
      status: 'not_available',
      error_message: 'Could not parse valuation from response',
    };
  } catch (error) {
    return {
      source,
      valuation_amount: null,
      status: 'error',
      error_message: error.message || 'API request failed',
    };
  }
}
