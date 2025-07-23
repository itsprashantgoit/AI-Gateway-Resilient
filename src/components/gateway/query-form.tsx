"use client";

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';

interface QueryFormProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export function QueryForm({ onSubmit, isLoading }: QueryFormProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit(query);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold flex items-center gap-2 font-headline">
            <Send className="h-6 w-6 text-primary" />
            Send a Request
        </CardTitle>
        <CardDescription>Enter a prompt and the gateway will select the best provider.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="e.g., 'Write a short story about a resilient AI gateway.'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={5}
            disabled={isLoading}
            className="text-base"
          />
          <Button type="submit" disabled={isLoading || !query.trim()} className="w-full sm:w-auto">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Routing...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Find Best Provider
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
