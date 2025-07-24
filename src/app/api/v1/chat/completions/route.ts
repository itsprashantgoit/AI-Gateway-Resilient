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
        // Ensure we return a JSON response even for upstream errors
        try {
            const parsedError = JSON.parse(errorBody);
            return NextResponse.json(parsedError, { status: response.status });
        } catch (e) {
            return NextResponse.json({ error: { message: `Upstream API error: ${errorBody}` } }, { status: response.status });
        }
    }

    if (stream && response.body) {
      const responseStream = new ReadableStream({
        async start(controller) {
          const rateLimitInfo = getRateLimitInfo(response.headers);
          const metadataChunk = `event: metadata\ndata: ${JSON.stringify({keyId: keyInfo.keyId, rateLimitInfo})}\n\n`;
          controller.enqueue(new TextEncoder().encode(metadataChunk));
          
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              // Pass through the stream from together.ai
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for(const line of lines) {
                if (line.startsWith('data:')) {
                    controller.enqueue(new TextEncoder().encode(`data: ${line.substring(5)}\n\n`));
                }
              }
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
    const rateLimitInfo = getRateLimitInfo(response.headers);

    return NextResponse.json({...data, keyId: keyInfo.keyId, rateLimitInfo});

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
