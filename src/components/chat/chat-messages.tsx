"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Message } from "./chat-layout"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Bot, User, Copy, Download } from "lucide-react"

type ChatMessagesProps = {
  messages: Message[]
  isLoading: boolean
}

function ChatMessageActions({ message, className }: { message: Message, className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }
  
  const handleDownload = () => {
    if (!message.imageUrl) return;
    const link = document.createElement('a');
    link.href = message.imageUrl;
    link.download = `generated-image-${message.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className={cn("flex items-center justify-end", className)}>
      {message.imageUrl ? (
        <Button variant="ghost" size="icon" onClick={handleDownload}>
           <span className="sr-only">Download image</span>
           <Download className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={handleCopy} disabled={copied}>
          <span className="sr-only">Copy message</span>
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div ref={scrollAreaRef} className="flex-1 overflow-y-auto p-4">
      <div className="flex flex-col gap-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "group flex items-start gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot />
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-[75%] rounded-lg p-3 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
                message.imageUrl ? "p-0" : "whitespace-pre-wrap"
              )}
            >
              {message.imageUrl ? (
                 <div className="flex flex-col gap-2">
                    <p className="p-3">{message.content}</p>
                    <Image src={message.imageUrl} alt={message.content} width={512} height={512} className="rounded-b-lg" />
                 </div>
              ) : (
                message.content
              )}
            </div>
            {message.role === "user" && (
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
            )}
            {message.role === "assistant" && !isLoading && (
               <ChatMessageActions message={message} className="self-center opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        ))}
         {isLoading && messages[messages.length-1]?.role !== 'assistant' && (
          <div className="flex items-start gap-3 justify-start">
            <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg p-3 text-sm">
                <span className="animate-pulse">...</span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
