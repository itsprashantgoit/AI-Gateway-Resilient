'use server';
/**
 * @fileOverview A flow for generating images from a text prompt.
 *
 * - generateImage - A function that handles the image generation process.
 */

import { ai } from '@/ai/genkit';
import { 
  GenerateImageInputSchema, 
  GenerateImageOutputSchema,
  type GenerateImageInput,
  type GenerateImageOutput
} from '@/ai/schemas/generate-image-schemas';


export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  return generateImageFlow(input);
}

const generateImageFlow = ai.defineFlow(
  {
    name: 'generateImageFlow',
    inputSchema: GenerateImageInputSchema,
    outputSchema: GenerateImageOutputSchema,
  },
  async ({ prompt }) => {
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const imageUrl = media.url;
    if (!imageUrl) {
        throw new Error('Image generation failed to return a URL.');
    }
    
    return { imageUrl };
  }
);
