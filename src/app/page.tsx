"use client";

import { useState, useEffect, useTransition } from 'react';
import { findBestProvider } from '@/app/actions';
import { GatewayHeader } from '@/components/gateway/header';
import { ProviderStatus, type Provider } from '@/components/gateway/provider-status';
import { QueryForm } from '@/components/gateway/query-form';
import { ResultDisplay } from '@/components/gateway/result-display';
import type { SelectBestProviderOutput } from '@/ai/flows/select-best-provider-flow';
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const initialProviders: Provider[] = [
  { name: 'Together.ai', latency: 150, cost: 0.00020, availability: 99.95 },
  { name: 'OpenAI', latency: 300, cost: 0.00050, availability: 99.80 },
  { name: 'Cloudflare AI', latency: 120, cost: 0.00015, availability: 99.99 },
  { name: 'Groq', latency: 50, cost: 0.00025, availability: 98.50 },
];

export default function GatewayPage() {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [result, setResult] = useState<SelectBestProviderOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    // Client-side only check to prevent hydration mismatch
    if (typeof window === 'undefined') return;

    const interval = setInterval(() => {
      setProviders(prevProviders =>
        prevProviders.map(p => ({
          ...p,
          latency: Math.max(30, p.latency + (Math.random() - 0.5) * 50),
          availability: Math.min(100, Math.max(98, p.availability + (Math.random() - 0.5) * 0.2)),
        }))
      );
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (userQuery: string) => {
    startTransition(async () => {
      setResult(null);
      const { result: apiResult, error: apiError } = await findBestProvider({
        providers: providers.map(p => ({...p, latency: Math.round(p.latency)})),
        userQuery,
      });
      
      if (apiError) {
        toast({
          variant: "destructive",
          title: "Gateway Error",
          description: apiError,
        });
      } else {
        setResult(apiResult);
      }
    });
  };
  
  return (
    <div className="min-h-screen w-full bg-background font-body">
      <main className="container mx-auto p-4 md:p-8 lg:p-12">
        <GatewayHeader />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-8">
            <ProviderStatus providers={providers} selectedProviderName={result?.providerName ?? null} />
          </div>
          <div className="space-y-8">
            <QueryForm onSubmit={handleSubmit} isLoading={isPending} />
            {isPending && (
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48 rounded-md" />
                  <Skeleton className="h-4 w-64 rounded-md" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-32 rounded-md" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                </CardContent>
              </Card>
            )}
            {result && !isPending && <ResultDisplay result={result} />}
          </div>
        </div>
      </main>
    </div>
  );
}
