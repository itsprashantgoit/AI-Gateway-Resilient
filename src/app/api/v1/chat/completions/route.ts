'use server';
import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

let keyIndex = 0;
const togetherKeys = keys.filter(k => k.provider === 'together.ai').map(k => k.apiKey);

function getNextKey() {
  if (togetherKeys.length === 0) {
    throw new Error("No keys available for together.ai");
  }
  const key = togetherKeys[keyIndex];
  keyIndex = (keyIndex + 1) % togetherKeys.length;
  return key;
}

export async function POST(req: Request) {
  try {
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

    const response = await fetch(TOGETHER_API_URL, {
      method: 'POST',
      headers,
      body,
      // Pass duplex: 'half' to stream responses.
      // @ts-expect-error
      duplex: 'half',
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Upstream API Error:", errorBody);
        return new NextResponse(errorBody, { status: response.status, headers: {'Content-Type': 'application/json'} });
    }

    if (stream && response.body) {
      const responseStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              controller.enqueue(new TextEncoder().encode(chunk));
            }
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      });

      return new NextResponse(responseStream, {
          headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
          }
      });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
