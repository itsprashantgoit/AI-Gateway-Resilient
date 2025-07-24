"use client";

import { useState } from 'react';
import { Booster } from '@/components/gateway/booster';
import { MainPrompt } from '@/components/gateway/main-prompt';
import { ResponseArea } from '@/components/gateway/response-area';
import { StatusDisplay } from '@/components/gateway/status-display';
import { models } from '@/components/gateway/models';
import { ImageStudio } from '@/components/gateway/image-studio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function GatewayTesterPage() {
  const [status, setStatus] = useState({ message: '', type: '' });
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Gateway Tester</h1>
      </div>
      
      <Tabs defaultValue="main">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="main">Main Prompt</TabsTrigger>
          <TabsTrigger value="booster">Booster</TabsTrigger>
          <TabsTrigger value="image-studio">Image Studio</TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <MainPrompt 
            models={models}
            setStatus={setStatus}
            setResponse={setResponse}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="booster">
          <Booster 
            models={models.filter(m => m.type === 'chat')} 
            setStatus={setStatus}
            setResponse={setResponse}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />
        </TabsContent>
        <TabsContent value="image-studio">
          <ImageStudio
            models={models.filter(m => m.type === 'image')}
            setStatus={setStatus}
            setResponse={setResponse}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      <StatusDisplay status={status} />
      
      <ResponseArea response={response} />
    </div>
  );
}
