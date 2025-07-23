"use server";

import { selectBestProvider, type SelectBestProviderInput, type SelectBestProviderOutput } from "@/ai/flows/select-best-provider-flow";

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
