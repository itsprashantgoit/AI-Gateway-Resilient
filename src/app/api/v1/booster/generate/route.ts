'use server';
import {NextResponse} from 'next/server';

// Dummy implementation for booster generate.
// In a real scenario, this would call multiple models.
export async function POST(req: Request) {
  try {
    const {requests} = await req.json();

    const promises = requests.map((r: any) => {
      // This is a simplified mock. A real implementation would need
      // to call the respective AI providers based on `r.model`.
      if (r.type === 'chat') {
        return Promise.resolve({
          status: 'fulfilled',
          value: {
            choices: [
              {message: {content: `Mock response for: ${r.prompt}`}},
            ],
          },
        });
      }
      if (r.type === 'image') {
        return Promise.resolve({
          status: 'fulfilled',
          value: {data: [{b64_json: ''}]}, // empty image
        });
      }
      return Promise.reject({
        status: 'rejected',
        reason: {message: 'Unsupported model type'},
      });
    });

    const results = await Promise.allSettled(promises);

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({error: error.message}, {status: 500});
  }
}
