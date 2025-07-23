"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Zap } from 'lucide-react';
import type { SelectBestProviderOutput } from '@/ai/flows/select-best-provider-flow';

interface ResultDisplayProps {
  result: SelectBestProviderOutput;
}

export function ResultDisplay({ result }: ResultDisplayProps) {
  return (
    <Card className="w-full bg-accent/10 border-accent animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          Provider Selected
        </CardTitle>
        <CardDescription>The AI gateway has routed your request to the optimal provider.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Selected Provider</p>
            <Badge variant="default" className="text-base mt-1 flex items-center gap-2 w-fit">
              <Zap className="h-4 w-4" />
              {result.providerName}
            </Badge>
          </div>
          <div>
              <p className="text-sm font-medium text-muted-foreground">Reasoning</p>
              <blockquote className="mt-1 text-foreground border-l-2 pl-4 italic">
                {result.reason}
              </blockquote>
          </div>
      </CardContent>
    </Card>
  );
}
