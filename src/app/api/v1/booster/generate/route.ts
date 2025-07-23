
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

    const headers = {
        'Authorization': `Bearer ${key.apiKey}`,
        'Content-Type': 'application/json'
    };

    let url: string;
    let body: any;

    if (type === 'chat') {
        url = `${TOGETHER_API_BASE_URL}chat/completions`;
        body = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            stream: request.stream,
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
    } else {
        throw new Error(`Unsupported model type: ${type}`);
    }

    const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    };

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
        let errorBody;
        let errorMessage;
        const resText = await res.text();
        try {
            // Try to parse as JSON, but fallback to raw text if it's not
            errorBody = JSON.parse(resText);
            errorMessage = errorBody?.error?.message || JSON.stringify(errorBody.error) || resText;
        } catch (e) {
            errorMessage = resText; // The response was not JSON (e.g., HTML error page)
        }

        let specificError = `API Error (Status ${res.status})`;
         switch (res.status) {
            case 400: specificError = `400 - Invalid Request: ${errorMessage}`; break;
            case 401: specificError = `401 - Authentication Error: Check your API Key.`; break;
            case 402: specificError = `402 - Payment Required: Account spending limit reached.`; break;
            case 403: specificError = `403 - Bad Request: Token limit likely exceeded.`; break;
            case 404: specificError = `404 - Not Found: Invalid model name or API endpoint.`; break;
            case 429: specificError = `429 - Rate Limit Exceeded: Too many requests.`; break;
            case 500: specificError = `500 - Server Error: Issue on provider's side.`; break;
            case 503: specificError = `503 - Engine Overloaded: High traffic on provider's side.`; break;
            default: specificError += `: ${errorMessage}`; break;
        }
        // This throw will be caught by the Promise.allSettled logic
        throw new Error(specificError);
    }
    
    const value = await res.json();
    return { ...value, keyId: key.keyId };
}

export async function POST(req: NextRequest) {
  try {
    const { requests, stream: streamAll } = await req.json();

    if (!requests || !Array.isArray(requests)) {
        return NextResponse.json({ error: "Invalid 'requests' field. Expected an array." }, { status: 400 });
    }
    
    // Non-streaming path
    if (!streamAll) {
       const promises = requests.map(async (r: any) => {
         try {
           const key = getNextKey();
           const value = await makeRequest(r, key);
           // Add keyId to the fulfilled value for the frontend
           return { status: 'fulfilled', value: { ...value, keyId: key.keyId }};
         } catch (error: any) {
           // The error from makeRequest is caught here
           const keyId = 'unknown'; // In case getNextKey() also fails
           return { status: 'rejected', reason: { message: error.message || 'Unknown error', keyId } };
         }
       });

       // Use Promise.allSettled to ensure we never crash the server
       const results = await Promise.allSettled(promises);

       const finalResults = results.map(promiseResult => {
            if (promiseResult.status === 'fulfilled') {
                return promiseResult.value; 
            } else {
                // The promise was rejected, return the reason
                return { 
                    status: 'rejected', 
                    reason: promiseResult.reason.reason || { message: 'An unknown error occurred during promise settlement.' }
                };
            }
       });
       return NextResponse.json(finalResults);
    }
    
    // Streaming path for Booster and Image Studio
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        
        const processRequest = async (request: any, index: number) => {
          let key;
          try {
            key = getNextKey();

            if (request.type === 'chat') {
                if (!request.stream) {
                     controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: 'Streaming is only supported for chat models with stream enabled.' }, keyId: key.keyId })}\n\n`));
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
                
                if (response.body) {
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
                                      finalData = { ...json, choices: [{ message: { content: "" }, finish_reason: null, index: 0 }] };
                                  }
                                  if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                                     const contentChunk = json.choices[0].delta.content;
                                     fullResponse += contentChunk;
                                     controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'chat', status: 'streaming', content: contentChunk, keyId: key.keyId })}\n\n`));
                                  }
                              } catch (e) {
                                  // ignore incomplete json
                              }
                          }
                      }
                  }
                }
            } else if (request.type === 'image') {
              const data = await makeRequest(request, key);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'image', status: 'fulfilled', content: data, keyId: key.keyId })}\n\n`));
            }

          } catch (e: any) {
             const keyId = key ? key.keyId : 'unknown';
             controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: e.message || 'Unknown error' }, keyId: keyId })}\n\n`));
          }
        };

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
    return NextResponse.json({error: `An internal server error occurred: ${error.message}`}, {status: 500});
  }
}
