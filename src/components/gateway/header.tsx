import { BrainCircuit, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function GatewayHeader() {
  return (
    <header className="mb-8 md:mb-12">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <BrainCircuit className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground font-headline">Resilient AI Gateway</h1>
            <p className="text-muted-foreground mt-1">View provider status and find the optimal API for your query.</p>
          </div>
        </div>
        <Link href="/gateway-tester" passHref>
          <Button variant="outline">
            <FlaskConical className="mr-2" />
            Gateway Tester
          </Button>
        </Link>
      </div>
    </header>
  );
}
