'use server';
import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

let keyIndex = 0;
const togetherKeys = keys.filter(k => k.provider === 'together.ai');

function getNextKey() {
  if (togetherKeys.length === 0) {
    throw new Error("No keys available for together.ai");
  }
  const keyInfo = togetherKeys[keyIndex];
  keyIndex = (keyIndex + 1) % togetherKeys.length;
  return keyInfo;
}

export async function POST(req: Request) {
  try {
    const incomingRequest = await req.json();
    const { model, messages, stream } = incomingRequest;
    const keyInfo = getNextKey();

    const headers = {
      'Authorization': `Bearer ${keyInfo.apiKey}`,
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
          // Send the key ID first
          const keyIdChunk = `event: key\ndata: ${JSON.stringify({keyId: keyInfo.keyId})}\n\n`;
          controller.enqueue(new TextEncoder().encode(keyIdChunk));
          
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
    // Add keyId to non-streaming response
    return NextResponse.json({...data, keyId: keyInfo.keyId});

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
