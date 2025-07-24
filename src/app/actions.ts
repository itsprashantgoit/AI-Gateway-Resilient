"use server";

import { selectBestProvider, type SelectBestProviderInput, type SelectBestProviderOutput } from "@/ai/flows/select-best-provider-flow";
import { generateImage } from "@/ai/flows/generate-image-flow";
import type { GenerateImageInput, GenerateImageOutput } from "@/ai/schemas/generate-image-schemas";

export async function findBestProvider(
  input: SelectBestProviderInput
): Promise<{ result: SelectBestProviderOutput | null; error: string | null }> {
  try {
    const result = await selectBestProvider(input);
    return { result, error: null };
  } catch (e) {
    console.error("AI flow error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during AI processing.";
    return { result: null, error: `Failed to select a provider: ${errorMessage}` };
  }
}

export async function generateImageAction(
  input: GenerateImageInput
): Promise<{ result: GenerateImageOutput | null; error: string | null }> {
  try {
    const result = await generateImage(input);
    return { result, error: null };
  } catch (e) {
    console.error("Image generation error:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during image generation.";
    return { result: null, error: `Failed to generate image: ${errorMessage}` };
  }
}
