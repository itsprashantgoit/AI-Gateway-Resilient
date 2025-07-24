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
    
    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers,
      body,
      // @ts-expect-error
      duplex: 'half',
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("Upstream API Error:", data);
        return NextResponse.json(data, { status: response.status });
    }
    
    const rateLimitInfo = getRateLimitInfo(response.headers);
    return NextResponse.json({ ...data, keyId: keyInfo.keyId, rateLimitInfo });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
