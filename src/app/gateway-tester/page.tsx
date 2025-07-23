
"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Booster } from '@/components/gateway/booster';
import { MainPrompt } from '@/components/gateway/main-prompt';
import { ResponseArea } from '@/components/gateway/response-area';
import { StatusDisplay } from '@/components/gateway/status-display';
import type { Model } from '@/components/gateway/models';
import { models } from '@/components/gateway/models';
import { ImageStudio } from '@/components/gateway/image-studio';

export default function GatewayTesterPage() {
  const [status, setStatus] = useState({ message: '', type: '' });
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Gateway Tester</h1>
      
      <MainPrompt 
        models={models}
        setStatus={setStatus}
        setResponse={setResponse}
        setIsLoading={setIsLoading}
        isLoading={isLoading}
      />

      <Booster 
        models={models} 
        setStatus={setStatus}
        setResponse={setResponse}
        setIsLoading={setIsLoading}
        isLoading={isLoading}
      />

      <ImageStudio
        models={models.filter(m => m.type === 'image')}
        setStatus={setStatus}
        setResponse={setResponse}
        setIsLoading={setIsLoading}
        isLoading={isLoading}
      />

      <StatusDisplay status={status} />
      
      <ResponseArea response={response} />
    </div>
  );
}
