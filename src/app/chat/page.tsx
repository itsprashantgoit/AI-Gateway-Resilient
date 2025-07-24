"use client"

import { ChatLayout } from "@/components/chat/chat-layout";
import { models } from "@/components/gateway/models";

export default function ChatPage() {
  const chatModels = models.filter(m => m.type === 'chat');

  return (
    <main className="flex h-screen flex-col items-center justify-center">
      <ChatLayout defaultModel={chatModels[0]} models={chatModels} />
    </main>
  );
}
