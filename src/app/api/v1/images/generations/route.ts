'use server';

import {NextResponse} from 'next/server';
import {ai} from '@/ai/genkit';

export async function POST(req: Request) {
  const {prompt, model, steps} = await req.json();

  const {media} = await ai.generate({
    model: 'googleai/gemini-2.0-flash-preview-image-generation',
    prompt: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  if (!media) {
    return NextResponse.json(
      {error: 'Failed to generate image'},
      {status: 500}
    );
  }

  const b64_json = media.url.substring(media.url.indexOf(',') + 1);

  return NextResponse.json({
    data: [
      {
        b64_json,
      },
    ],
  });
}
