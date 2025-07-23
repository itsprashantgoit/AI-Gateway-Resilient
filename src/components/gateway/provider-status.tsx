"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Server, Zap, DollarSign } from 'lucide-react';

export interface Provider {
  name: string;
  latency: number;
  cost: number;
  availability: number;
}

interface ProviderStatusProps {
  providers: Provider[];
  selectedProviderName: string | null;
}

const getAvailabilityColorClass = (availability: number) => {
  if (availability > 99.9) return 'bg-chart-2';
  if (availability > 99) return 'bg-chart-4';
  return 'bg-chart-1';
};

export function ProviderStatus({ providers, selectedProviderName }: ProviderStatusProps) {
  return (
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-headline text-2xl">
          <Server className="h-6 w-6 text-primary" />
          Real-time Provider Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className={cn(
              'rounded-lg border p-4 transition-all duration-300 space-y-3',
              selectedProviderName === provider.name
                ? 'border-primary ring-2 ring-primary bg-primary/5'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{provider.name}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">{(provider.availability).toFixed(2)}%</span>
                    <div title={`Availability: ${provider.availability.toFixed(2)}%`} className={cn('h-3 w-3 rounded-full', getAvailabilityColorClass(provider.availability))} />
                </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" /> Latency</span>
                <span className="font-mono font-semibold text-foreground">{provider.latency.toFixed(0)}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><DollarSign className="h-4 w-4" /> Cost / req</span>
                <span className="font-mono font-semibold text-foreground">${provider.cost.toFixed(5)}</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
