
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
        const reset = response.headers.get('x-ratelimit-reset');
        const waitTime = reset ? parseInt(reset, 10) * 1000 : 5000; // Wait 5s if header is missing
        console.warn(`Rate limit exceeded. Retrying after ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        // Decrement retryCount and call again
        return makeRequestWithRetry(url, options, isStream, retryCount - 1);
    }
    
    if (!response.ok) {
        let errorBody;
        let errorMessage;
        const resText = await response.text();
        try {
            errorBody = JSON.parse(resText);
            errorMessage = errorBody?.error?.message || JSON.stringify(errorBody.error) || resText;
        } catch (e) {
            errorMessage = resText;
        }

        let specificError = `API Error (Status ${response.status})`;
        switch (response.status) {
           case 400: specificError = `400 - Invalid Request: ${errorMessage}`; break;
           case 401: specificError = `401 - Authentication Error: Check your API Key.`; break;
           case 402: specificError = `402 - Payment Required: Account spending limit reached.`; break;
           case 403: specificError = `403 - Bad Request: Token limit likely exceeded.`; break;
           case 404: specificError = `404 - Not Found: Invalid model name or API endpoint.`; break;
           case 429: specificError = `429 - Rate Limit Exceeded: Please try again later.`; break;
           case 500: specificError = `500 - Server Error: Issue on provider's side.`; break;
           case 503: specificError = `503 - Engine Overloaded: High traffic on provider's side.`; break;
           default: specificError += `: ${errorMessage}`; break;
       }
       throw new Error(specificError);
    }

    if (isStream) {
        return response; // Return the raw response for streaming
    }
    
    const value = await response.json();
    const rateLimitInfo = getRateLimitInfo(response.headers);
    return { value, rateLimitInfo };
}


async function makeRequest(request: any, key: any) {
    const { model, prompt, type, steps, stream } = request;

    const headers = {
        'Authorization': `Bearer ${key.apiKey}`,
        'Content-Type': 'application/json'
    };

    let url: string;
    let body: any;

    if (type === 'chat') {
        url = `${TOGETHER_API_BASE_URL}chat/completions`;
        body = { model, messages: [{ role: 'user', content: prompt }], stream };
    } else if (type === 'image') {
        url = `${TOGETHER_API_BASE_URL}images/generations`;
        body = { model, prompt, n: 1, steps, response_format: "b64_json" };
    } else {
        throw new Error(`Unsupported model type: ${type}`);
    }

    const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    };
    
    // For non-streaming, we can wrap the retry logic here
    const { value, rateLimitInfo } = await makeRequestWithRetry(url, fetchOptions, false);
    return { ...value, keyId: key.keyId, rateLimitInfo };
}

export async function POST(req: NextRequest) {
  try {
    const { requests, stream: streamAll } = await req.json();

    if (!requests || !Array.isArray(requests)) {
        return NextResponse.json({ error: "Invalid 'requests' field. Expected an array." }, { status: 400 });
    }
    
    if (!streamAll) {
       const promises = requests.map(async (r: any) => {
         try {
           const key = getNextKey();
           const value = await makeRequest(r, key);
           return { status: 'fulfilled', value: { ...value, keyId: key.keyId }};
         } catch (error: any) {
           const keyId = 'unknown'; 
           return { status: 'rejected', reason: { message: error.message || 'Unknown error', keyId } };
         }
       });

       const results = await Promise.allSettled(promises);

       const finalResults = results.map(promiseResult => {
            if (promiseResult.status === 'fulfilled') {
                return promiseResult.value; 
            } else {
                return { 
                    status: 'rejected', 
                    reason: promiseResult.reason.reason || { message: 'An unknown error occurred during promise settlement.' }
                };
            }
       });
       return NextResponse.json(finalResults);
    }
    
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        
        const processRequest = async (request: any, index: number) => {
          let key;
          try {
            key = getNextKey();

            const headers = {
                'Authorization': `Bearer ${key.apiKey}`,
                'Content-Type': 'application/json'
            };

            let url, body;
            const isChatStream = request.type === 'chat' && request.stream;

            if (isChatStream) {
                url = `${TOGETHER_API_BASE_URL}chat/completions`;
                body = { model: request.model, messages: [{ role: 'user', content: request.prompt }], stream: true };
            } else if (request.type === 'image') {
                url = `${TOGETHER_API_BASE_URL}images/generations`;
                body = { model: request.model, prompt: request.prompt, n: 1, steps: request.steps, response_format: "b64_json" };
            } else if (request.type === 'chat' && !request.stream) {
                 controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: 'Streaming is only supported for chat models with stream enabled.' }, keyId: key.keyId })}\n\n`));
                 return;
            } else {
                 controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, status: 'rejected', reason: { message: `Unsupported request type: ${request.type}`}, keyId: key.keyId })}\n\n`));
                 return;
            }

            const fetchOptions: RequestInit = {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                 // @ts-expect-error
                duplex: 'half',
            };

            const response = await makeRequestWithRetry(url, fetchOptions, isChatStream);

            if (isChatStream) {
                if (response.body) {
                  const rateLimitInfo = getRateLimitInfo(response.headers);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'metadata', keyId: key.keyId, rateLimitInfo })}\n\n`));

                  const reader = response.body.getReader();
                  const decoder = new TextDecoder();
                  let fullResponse = "";
                  let finalData: any = null;

                  while(true) {
                      const {done, value} = await reader.read();
                      if (done) {
                          if (finalData) {
                              finalData.choices[0].message.content = fullResponse;
                               controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'chat', status: 'fulfilled', content: finalData })}\n\n`));
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
                                     controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'chat', status: 'streaming', content: contentChunk })}\n\n`));
                                  }
                              } catch (e) {
                                  // ignore incomplete json
                              }
                          }
                      }
                  }
                }
            } else { // Image or non-streamed chat
              const { value, rateLimitInfo } = response;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ index, type: 'image', status: 'fulfilled', content: value, keyId: key.keyId, rateLimitInfo: rateLimitInfo })}\n\n`));
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
