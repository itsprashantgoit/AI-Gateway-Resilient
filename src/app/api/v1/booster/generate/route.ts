'use server';
import {NextResponse} from 'next/server';
import keys from '@/keys.json';

const TOGETHER_API_BASE_URL = 'https://api.together.xyz/v1/';

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

async function makeRequest(request: any) {
    const { model, prompt, type, steps, stream } = request;
    const apiKey = getNextKey();
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
    } else if (type === 'image') {
        url = `${TOGETHER_API_BASE_URL}images/generations`;
        body = {
            model: model,
            prompt: prompt,
            n: 1,
            steps: steps,
        };
    } else {
        throw new Error(`Unsupported model type: ${type}`);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        // @ts-expect-error
        duplex: 'half',
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw errorBody.error || new Error(`API request failed with status ${response.status}`);
    }
    
    if (type === 'chat' && stream) {
        if (!response.body) {
            throw new Error("Stream response body is null");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let finalData: any = null;

        while(true) {
            const {done, value} = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.trim().startsWith('data:')) {
                    const data = line.substring(5).trim();
                    if (data === '[DONE]') {
                        break;
                    }
                    try {
                        const json = JSON.parse(data);
                        if (!finalData) {
                            finalData = json;
                            finalData.choices = [{ message: { content: ""}}];
                        }
                        if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                           fullResponse += json.choices[0].delta.content;
                        }
                    } catch (e) {
                        // ignore incomplete json
                    }
                }
            }
        }
        if (finalData) {
            finalData.choices[0].message.content = fullResponse;
            return finalData;
        } else {
            throw new Error("Failed to process stream");
        }
    }


    const data = await response.json();
    return data;
}


export async function POST(req: Request) {
  try {
    const { requests } = await req.json();

    const promises = requests.map((r: any) => {
        return makeRequest(r).then(value => ({ status: 'fulfilled', value })).catch(reason => ({ status: 'rejected', reason: { message: reason.message || 'Unknown error' } }));
    });

    const results = await Promise.all(promises);

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({error: error.message}, {status: 500});
  }
}
