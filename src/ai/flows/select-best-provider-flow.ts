'use server';
/**
 * @fileOverview An AI agent for selecting the best AI provider based on real-time performance metrics.
 *
 * - selectBestProvider - A function that handles the provider selection process.
 * - SelectBestProviderInput - The input type for the selectBestProvider function.
 * - SelectBestProviderOutput - The return type for the selectBestProvider function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SelectBestProviderInputSchema = z.object({
  providers: z.array(
    z.object({
      name: z.string().describe('The name of the AI provider.'),
      latency: z.number().describe('The latency of the provider in milliseconds.'),
      cost: z.number().describe('The cost per request for the provider.'),
      availability: z
        .number()
        .describe('The availability of the provider as a percentage (0-100).'),
    })
  ).describe('An array of available AI providers with their performance metrics.'),
  userQuery: z.string().describe('The user query to be processed by the AI provider.'),
});
export type SelectBestProviderInput = z.infer<typeof SelectBestProviderInputSchema>;

const SelectBestProviderOutputSchema = z.object({
  providerName: z.string().describe('The name of the selected AI provider.'),
  reason: z.string().describe('The reason for selecting this provider.'),
});
export type SelectBestProviderOutput = z.infer<typeof SelectBestProviderOutputSchema>;

export async function selectBestProvider(input: SelectBestProviderInput): Promise<SelectBestProviderOutput> {
  return selectBestProviderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'selectBestProviderPrompt',
  input: {schema: SelectBestProviderInputSchema},
  output: {schema: SelectBestProviderOutputSchema},
  prompt: `You are an AI gateway responsible for selecting the best AI provider to handle a user query.
  You will be given a list of available providers with their performance metrics (latency, cost, availability).
  Your goal is to select the provider that offers the best balance of performance, cost, and reliability for the given user query.

  Here are the available providers and their metrics:
  {{#each providers}}
  - Name: {{this.name}}
    Latency: {{this.latency}}ms
    Cost: {{this.cost}}
    Availability: {{this.availability}}%
  {{/each}}

  User Query: {{{userQuery}}}

  Based on this information, select the best provider and explain your reasoning. Your response MUST be in JSON format.
  {
    "providerName": "[provider name]",
    "reason": "[reason for selecting this provider]"
  }`,
});

const selectBestProviderFlow = ai.defineFlow(
  {
    name: 'selectBestProviderFlow',
    inputSchema: SelectBestProviderInputSchema,
    outputSchema: SelectBestProviderOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
