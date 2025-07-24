'use server';

import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations';

let keyIndex = 0;
const togetherKeys = keys.filter(k => k.provider === 'together.ai');

function getNextKey() {
  if (togetherKeys.length === 0) {
    throw new Error("No keys available for together.ai");
  }
  const key = togetherKeys[keyIndex];
  keyIndex = (keyIndex + 1) % togetherKeys.length;
  return key;
}

function getRateLimitInfo(headers: Headers) {
    return {
        ratelimitLimit: headers.get('x-ratelimit-limit'),
        ratelimitRemaining: headers.get('x-ratelimit-remaining'),
        ratelimitReset: headers.get('x-ratelimit-reset'),
        tokenlimitLimit: headers.get('x-tokenlimit-limit'),
        tokenlimitRemaining: headers.get('x-tokenlimit-remaining'),
    };
}

async function makeRequestWithRetry(url: string, options: RequestInit, retryCount = 1) {
    let response = await fetch(url, options);

    if (response.status === 429 && retryCount > 0) {
        const resetHeader = response.headers.get('x-ratelimit-reset');
        let waitTime = 5000; // Default wait time
        if (resetHeader) {
            let resetValue = parseInt(resetHeader, 10);
            if (resetValue < 1000) {
                 waitTime = resetValue * 1000;
            } else {
                 waitTime = resetValue;
            }
        }
        console.warn(`Rate limit exceeded for image generation. Retrying after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return makeRequestWithRetry(url, options, retryCount - 1);
    }
    
    if (!response.ok) {
        const errorBody = await response.json();
        const errorMessage = errorBody?.error?.message || `Upstream API Error`;
        const error = new Error(errorMessage);
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
    
    return response;
}


export async function POST(req: Request) {
  try {
    const incomingRequest = await req.json();
    const { model, prompt, n, steps } = incomingRequest;
    const keyInfo = getNextKey();

    const headers = {
      'Authorization': `Bearer ${keyInfo.apiKey}`,
      'Content-Type': 'application/json'
    };

    const body = JSON.stringify({
      model,
      prompt,
      n,
      steps,
      response_format: "b64_json"
    });
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body,
      // @ts-expect-error
      duplex: 'half',
    };

    const response = await makeRequestWithRetry(TOGETHER_API_URL, fetchOptions);
    const data = await response.json();
    
    const rateLimitInfo = getRateLimitInfo(response.headers);
    return NextResponse.json({ ...data, keyId: keyInfo.keyId, rateLimitInfo });

  } catch (error: any) {
    console.error('Image Generation Proxy Error:', error);
    // @ts-ignore
    const status = error.status || 500;
    return NextResponse.json({ error: { message: error.message } }, { status });
  }
}
