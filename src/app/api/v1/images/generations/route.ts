'use server';

import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/images/generations';

let keyIndex = 0;
const togetherKeys = keys.filter(k => k.provider === 'together.ai').map(k => k.apiKey);

function getNextKey() {
  const key = togetherKeys[keyIndex];
  keyIndex = (keyIndex + 1) % togetherKeys.length;
  return key;
}

export async function POST(req: Request) {
  const incomingRequest = await req.json();
  const { model, prompt, n, steps } = incomingRequest;

  const headers = {
    'Authorization': `Bearer ${getNextKey()}`,
    'Content-Type': 'application/json'
  };

  const body = JSON.stringify({
    model,
    prompt,
    n,
    steps
  });
  
  try {
    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Upstream API Error:", errorBody);
        return new NextResponse(errorBody, { status: response.status, headers: {'Content-Type': 'application/json'} });
    }

    const data = await response.json();

    // The together.ai image generation response is different from OpenAI's.
    // We need to adapt it to what the frontend expects (b64_json).
    // The together.ai response has `data[].b64_json`.
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
