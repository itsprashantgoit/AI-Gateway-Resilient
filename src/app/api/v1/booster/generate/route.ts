'use server';
import {NextRequest, NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_BASE_URL = 'https://api.together.xyz/v1/';

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

async function makeRequest(request: any, apiKey: string) {
    const { model, prompt, type, steps, stream } = request;
    
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    let url: string;
    let body: any;

    if (type === 'chat') {
        url = `${TOGETHER_API_BASE_URL}chat/completions`;
        body = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            stream: stream,
        };
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            // @ts-expect-error
            duplex: 'half',
        };
        return await fetch(url, fetchOptions);

    } else if (type === 'image') {
        url = `${TOGETHER_API_BASE_URL}images/generations`;
        body = {
            model: model,
            prompt: prompt,
            n: 1,
            steps: steps,
        };
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        };
        return await fetch(url, fetchOptions);

    } else {
        throw new Error(`Unsupported model type: ${type}`);
    }
}

export async function POST(req: NextRequest) {
  try {
    const { requests, stream: streamAll } = await req.json();

    if (!streamAll) {
       const promises = requests.map(async (r: any) => {
            const key = getNextKey();
            try {
                const res = await makeRequest(r, key.apiKey);
                if (!res.ok) {
                    const errorBody = await res.json();
                    throw errorBody.error || new Error(`API request failed with status ${res.status}`);
                }
                const value = await res.json();
                return { status: 'fulfilled', value: { ...value, keyId: key.keyId } };
            } catch (reason: any) {
                return { status: 'rejected', reason: { message: reason.message || 'Unknown error' }, keyId: key.keyId };
            }
        });

        const results = await Promise.all(promises);
        return NextResponse.json(results);
    }
    
    // Handle streaming
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        
        const processRequest = async (request: any, index: number) => {
          const key = getNextKey();
          try {
            const response = await makeRequest(request, key.apiKey);

            if (!response.ok) {
                const errorBody = await response.json();
                throw errorBody.error || new Error(`API request failed with status ${response.status}`);
            }

            if (request.type === 'chat' && request.stream && response.body) {
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let fullResponse = "";
              let finalData: any = null;

              while(true) {
                  const {done, value} = await reader.read();
                  if (done) {
                      if (finalData) {
                          finalData.choices[0].message.content = fullResponse;
                           controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'chat', status: 'fulfilled', content: finalData, keyId: key.keyId })}\n\n`));
                      }
                      break;
                  };

                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                      if (line.trim().startsWith('data:')) {
                          const data = line.substring(5).trim();
                          if (data === '[DONE]') break;
                          try {
                              const json = JSON.parse(data);
                              if (!finalData) {
                                  finalData = { ...json, choices: [{ message: { content: "" }}] };
                              }
                              if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                                 const contentChunk = json.choices[0].delta.content;
                                 fullResponse += contentChunk;
                                 // Stream chunk
                                 controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'chat', status: 'streaming', content: contentChunk, keyId: key.keyId })}\n\n`));
                              }
                          } catch (e) {
                              // ignore incomplete json
                          }
                      }
                  }
              }

            } else {
              // Non-streaming chat or image
              const data = await response.json();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: request.type, status: 'fulfilled', content: {...data, keyId: key.keyId}, keyId: key.keyId })}\n\n`));
            }

          } catch (e: any) {
             controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: e.message || 'Unknown error' }, keyId: key.keyId })}\n\n`));
          }
        };

        // Process all requests concurrently
        await Promise.all(requests.map(processRequest));

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });

  } catch (error: any) {
    return NextResponse.json({error: error.message}, {status: 500});
  }
}
