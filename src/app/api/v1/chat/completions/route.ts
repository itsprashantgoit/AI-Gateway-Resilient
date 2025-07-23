'use server';
import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

let keyIndex = 0;
const togetherKeys = keys.filter(k => k.provider === 'together.ai').map(k => k.apiKey);

function getNextKey() {
  const key = togetherKeys[keyIndex];
  keyIndex = (keyIndex + 1) % togetherKeys.length;
  return key;
}

export async function POST(req: Request) {
  const incomingRequest = await req.json();
  const { model, messages, stream } = incomingRequest;

  const headers = {
    'Authorization': `Bearer ${getNextKey()}`,
    'Content-Type': 'application/json'
  };

  const body = JSON.stringify({
    model: model,
    messages: messages,
    stream: stream,
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
    
    // If streaming, return the stream directly
    if (stream && response.body) {
      return new NextResponse(response.body, {
          headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
          }
      });
    }

    // If not streaming, parse and return JSON
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
