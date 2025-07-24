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

async function makeRequestWithRetry(url: string, options: RequestInit, isStream: boolean = false, retryCount = 1) {
    let response = await fetch(url, options);

    if (response.status === 429 && retryCount > 0) {
        const resetHeader = response.headers.get('x-ratelimit-reset');
        // The reset value can be in seconds or milliseconds, we'll assume seconds if it's a small number
        let waitTime = 5000; // Default wait time
        if (resetHeader) {
            let resetValue = parseInt(resetHeader, 10);
            // Check if the value is likely seconds (e.g., < 1000) and convert to ms
            if (resetValue < 1000) {
                 waitTime = resetValue * 1000;
            } else {
                 waitTime = resetValue; // Assume it's already ms
            }
        }
        console.warn(`Rate limit exceeded. Retrying after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return makeRequestWithRetry(url, options, isStream, retryCount - 1);
    }
    
    if (!response.ok) {
        const errorBody = await response.text();
        let parsedError;
        try {
            parsedError = JSON.parse(errorBody);
        } catch (e) {
            parsedError = { error: { message: `Upstream API error: ${errorBody}` } };
        }
        // Re-throw with status to be handled by the main try-catch
        const error = new Error(parsedError.error.message || 'Unknown upstream error');
        // @ts-ignore
        error.status = response.status;
        throw error;
    }
    
    return response;
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
    
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body,
      // @ts-expect-error
      duplex: 'half',
    };

    const response = await makeRequestWithRetry(TOGETHER_API_URL, fetchOptions, stream);

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
    // @ts-ignore
    const status = error.status || 500;
    return NextResponse.json({ error: { message: error.message } }, { status });
  }
}
