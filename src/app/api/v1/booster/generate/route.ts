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

async function makeRequest(request: any, key: any) {
    const { model, prompt, type, steps } = request;

    try {
        const headers = {
            'Authorization': `Bearer ${key.apiKey}`,
            'Content-Type': 'application/json'
        };

        let url: string;
        let body: any;
        let fetchOptions: RequestInit;

        if (type === 'chat') {
            url = `${TOGETHER_API_BASE_URL}chat/completions`;
            body = {
                model: model,
                messages: [{ role: 'user', content: prompt }],
                stream: false, // Non-streaming for this path
            };
            fetchOptions = {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            };
        } else if (type === 'image') {
            url = `${TOGETHER_API_BASE_URL}images/generations`;
            body = {
                model: model,
                prompt: prompt,
                n: 1,
                steps: steps,
                response_format: "b64_json"
            };
            fetchOptions = {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            };
        } else {
            throw new Error(`Unsupported model type: ${type}`);
        }

        const res = await fetch(url, fetchOptions);

        if (!res.ok) {
            const resText = await res.text();
            let errorBody;
            try {
                errorBody = JSON.parse(resText);
            } catch (e) {
                errorBody = { error: { message: resText } };
            }
            const errorMessage = errorBody?.error?.message || JSON.stringify(errorBody.error) || `API request failed with status ${res.status}`;
            throw new Error(errorMessage);
        }
        
        const value = await res.json();
        return { status: 'fulfilled', value: { ...value, keyId: key.keyId } };

    } catch (error: any) {
        return { status: 'rejected', reason: { message: error.message || 'Unknown error' }, keyId: key.keyId };
    }
}

export async function POST(req: NextRequest) {
  try {
    const { requests, stream: streamAll } = await req.json();

    if (!requests || !Array.isArray(requests)) {
        return NextResponse.json({ error: "Invalid 'requests' field. Expected an array." }, { status: 400 });
    }
    
    // Non-streaming path for Booster (chat) and Image Studio
    if (!streamAll) {
       const promises = requests.map(r => makeRequest(r, getNextKey()));
       const results = await Promise.all(promises);
       return NextResponse.json(results);
    }
    
    // Streaming path for Booster (chat only)
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        
        const processRequest = async (request: any, index: number) => {
          const key = getNextKey();
          try {
            if (request.type !== 'chat') {
                 controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: 'Streaming is only supported for chat models.' }, keyId: key.keyId })}\n\n`));
                 return;
            }

            const fetchOptions: RequestInit = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key.apiKey}`,
                    'Content-Type': 'application/json'
                },
                 body: JSON.stringify({
                    model: request.model,
                    messages: [{ role: 'user', content: request.prompt }],
                    stream: true,
                }),
                // @ts-expect-error
                duplex: 'half',
            };
            const response = await fetch(`${TOGETHER_API_BASE_URL}chat/completions`, fetchOptions);

            if (!response.ok) {
                const errorText = await response.text();
                let errorBody;
                try {
                    errorBody = JSON.parse(errorText);
                } catch(e) {
                    errorBody = { error: { message: errorText } };
                }
                throw new Error(errorBody?.error?.message || JSON.stringify(errorBody.error) || `API request failed with status ${response.status}`);
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
                                  // Create a finalData structure that matches the non-streaming one
                                  finalData = { ...json, choices: [{ message: { content: "" }, finish_reason: null, index: 0 }] };
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
              // This path should not be hit if streamAll is true
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
    console.error("Critical Booster Error:", error);
    // Return a structured JSON error instead of letting the server crash
    return NextResponse.json({error: `An internal server error occurred: ${error.message}`}, {status: 500});
  }
}
