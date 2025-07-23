'use server';
import {ai} from '@/ai/genkit';
import {NextResponse} from 'next/server';
import {Message, Role, Part} from 'genkit/model';

// convert messages from the OpanAI format to the Genkit format
function convertMessages(
  messages: {role: Role; content: string}[]
): Message[] {
  const genkitMessages: Message[] = [];
  for (const message of messages) {
    const parts: Part[] = [{text: message.content}];
    genkitMessages.push({
      role: message.role,
      content: parts,
    });
  }
  return genkitMessages;
}

export async function POST(req: Request) {
  const {model, messages, stream} = await req.json();

  if (stream) {
    const {stream, response} = ai.generateStream({
      model: model,
      history: convertMessages(messages.slice(0, messages.length - 1)),
      prompt: messages[messages.length - 1].content,
    });

    const encoder = new TextEncoder();
    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const content = chunk.text;
        const out = {
          choices: [
            {
              delta: {
                content: content,
              },
            },
          ],
        };
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(out)));
      },
    });

    (async () => {
      await response;
      const finalChunk = new TransformStream({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush(controller) {
          controller.enqueue(encoder.encode('\n\ndata: [DONE]\n\n'));
        },
      });
      stream.pipeThrough(transformStream).pipeTo(finalChunk.writable);
    })();

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } else {
    const result = await ai.generate({
      model: model,
      history: convertMessages(messages.slice(0, messages.length - 1)),
      prompt: messages[messages.length - 1].content,
    });

    return NextResponse.json({
      choices: [{message: {content: result.text}}],
    });
  }
}
