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

export async function POST(req: Request) {
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
    steps
  });
  
  try {
    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers,
      body,
      // @ts-expect-error
      duplex: 'half'
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Upstream API Error:", errorBody);
        return new NextResponse(errorBody, { status: response.status, headers: {'Content-Type': 'application/json'} });
    }

    const data = await response.json();
    return NextResponse.json({ ...data, keyId: keyInfo.keyId });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
