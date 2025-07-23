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
    const { model, prompt, type, steps } = request;
    const apiKey = getNextKey();
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    let url: string;
    let body: string;

    if (type === 'chat') {
        url = `${TOGETHER_API_BASE_URL}chat/completions`;
        body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
        });
    } else if (type === 'image') {
        url = `${TOGETHER_API_BASE_URL}images/generations`;
        body = JSON.stringify({
            model: model,
            prompt: prompt,
            n: 1,
            steps: steps,
        });
    } else {
        throw new Error(`Unsupported model type: ${type}`);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body
    });
    
    const data = await response.json();

    if (!response.ok) {
        throw data.error || new Error(`API request failed with status ${response.status}`);
    }
    
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
