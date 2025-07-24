"use client"

import { useState } from 'react';
import { Booster } from '@/components/gateway/booster';
import { ResponseArea } from '@/components/gateway/response-area';
import { StatusDisplay } from '@/components/gateway/status-display';
import { models } from '@/components/gateway/models';
import { ImageStudio } from '@/components/gateway/image-studio';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Bot, PencilRuler } from 'lucide-react';
import { ChatView } from '@/components/chat/chat-view';

export default function ChatPage() {
  const [status, setStatus] = useState({ message: '', type: '' });
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="container mx-auto p-4 flex flex-col h-screen">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" passHref>
          <Button variant="outline" size="icon">
            <ArrowLeft />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">AI Studio</h1>
      </div>
      
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="chat">
            <MessageCircle className="mr-2"/>
            Chat
            </TabsTrigger>
          <TabsTrigger value="booster">
            <Bot className="mr-2" />
            Booster
          </TabsTrigger>
          <TabsTrigger value="image-studio">
            <PencilRuler className="mr-2" />
            Image Studio
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chat" className="flex-1">
          <ChatView />
        </TabsContent>
        <TabsContent value="booster">
           <Booster 
            models={models.filter(m => m.type === 'chat')} 
            setStatus={setStatus}
            setResponse={setResponse}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />
          <StatusDisplay status={status} />
          <ResponseArea response={response} />
        </TabsContent>
        <TabsContent value="image-studio">
          <ImageStudio
            models={models.filter(m => m.type === 'image')}
            setStatus={setStatus}
            setResponse={setResponse}
            setIsLoading={setIsLoading}
            isLoading={isLoading}
          />
          <StatusDisplay status={status} />
          <ResponseArea response={response} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
