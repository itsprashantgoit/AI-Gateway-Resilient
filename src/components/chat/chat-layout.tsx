"use client"

import { useState, useEffect, useRef } from "react"
import { v4 as uuidv4 } from "uuid"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { ChatHistory } from "./chat-history"
import { Model, models } from "../gateway/models"
import { generateImageAction } from "@/app/actions";
import type { GenerateImageInput } from "@/ai/schemas/generate-image-schemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  imageUrl?: string | null
}

export interface ChatSession {
  id: string
  name: string
  modelId: string
  messages: Message[]
}

type ChatLayoutProps = {
  defaultModel: Model
  models: Model[]
}

export function ChatLayout({ defaultModel, models: chatModels }: ChatLayoutProps) {
  const [history, setHistory] = useState<ChatSession[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const savedHistory = localStorage.getItem("chatHistory")
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory))
    }
  }, [])

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(history))
    } else {
      localStorage.removeItem("chatHistory")
    }
  }, [history])

  const activeChat = history.find((chat) => chat.id === activeChatId)

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: uuidv4(),
      name: "New Chat",
      modelId: defaultModel.id,
      messages: [],
    }
    setHistory((prev) => [newChat, ...prev])
    setActiveChatId(newChat.id)
  }
  
  const clearHistory = () => {
    setHistory([])
    setActiveChatId(null)
  }
  
  const deleteChat = (idToDelete: string) => {
    setHistory(prev => {
        const newHistory = prev.filter(chat => chat.id !== idToDelete);
        if (activeChatId === idToDelete) {
            setActiveChatId(newHistory.length > 0 ? newHistory[0].id : null);
        }
        return newHistory;
    });
  }

  useEffect(() => {
    if (activeChatId === null && history.length > 0) {
      setActiveChatId(history[0].id)
    } else if (history.length === 0) {
        createNewChat()
    }
  }, [activeChatId, history])


  const handleModelChange = (modelId: string) => {
    if (activeChatId) {
      setHistory((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId ? { ...chat, modelId } : chat
        )
      )
    }
  }

  const handleImageGeneration = async (prompt: string, userMessage: Message) => {
    if (!activeChatId) return;

    setHistory((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [...chat.messages, userMessage],
            }
          : chat
      )
    );
    setIsLoading(true);

    const loadingMessage: Message = {
      id: uuidv4(),
      role: "assistant",
      content: `Generating image for: "${prompt}"...`,
    };

    setHistory((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [...chat.messages, loadingMessage],
            }
          : chat
      )
    );

    const { result, error } = await generateImageAction({ prompt });
    setIsLoading(false);

    if (error) {
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: `Image generation failed: ${error}`,
      };
      setHistory((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map(m => m.id === loadingMessage.id ? errorMessage : m)
              }
            : chat
        )
      );
    } else if (result) {
      const imageMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: `Generated image for: "${prompt}"`,
        imageUrl: result.imageUrl,
      };
      setHistory((prev) =>
        prev.map((chat) =>
          chat.id === activeChatId
            ? {
                ...chat,
                messages: chat.messages.map(m => m.id === loadingMessage.id ? imageMessage : m)
              }
            : chat
        )
      );
    }
  };


  const handleSend = async (messageContent: string) => {
    if (!activeChat) return

    const newMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: messageContent,
    }

    // Handle image generation command
    if (messageContent.startsWith("/imagine ")) {
      const prompt = messageContent.substring(8).trim();
      handleImageGeneration(prompt, newMessage);
      return;
    }


    const updatedMessages = [...activeChat.messages, newMessage]

    setHistory((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: updatedMessages,
              name:
                chat.messages.length === 0
                  ? messageContent.substring(0, 30)
                  : chat.name,
            }
          : chat
      )
    )

    setIsLoading(true)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      const response = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: activeChat.modelId,
          messages: updatedMessages.map(({id, role, content}) => ({role, content})),
          stream: true,
        }),
        signal: abortController.signal,
      })

      if (!response.ok || !response.body) {
        const errorText = await response.text()
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let assistantMessageId = uuidv4()
      let assistantContent = ""
      let firstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
             if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                if (data === '[DONE]') {
                    break;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                        assistantContent += json.choices[0].delta.content

                        if (firstChunk) {
                          const assistantMessage: Message = {
                            id: assistantMessageId,
                            role: "assistant",
                            content: assistantContent,
                          }
                          setHistory((prev) =>
                            prev.map((chat) =>
                              chat.id === activeChatId
                                ? {
                                    ...chat,
                                    messages: [...updatedMessages, assistantMessage],
                                  }
                                : chat
                            )
                          )
                          firstChunk = false
                        } else {
                          setHistory((prev) =>
                            prev.map((chat) =>
                              chat.id === activeChatId
                                ? {
                                    ...chat,
                                    messages: chat.messages.map((m) =>
                                      m.id === assistantMessageId
                                        ? { ...m, content: assistantContent }
                                        : m
                                    ),
                                  }
                                : chat
                            )
                          )
                        }
                    }
                } catch (e) {
                    console.error("Error parsing stream chunk:", e, "Data:", data)
                }
            }
        }
      }
    } catch (error: any) {
       if (error.name === 'AbortError') {
        console.log('Fetch aborted.');
      } else {
        console.error("Chat fetch error:", error)
        const errorMessage: Message = {
          id: uuidv4(),
          role: "assistant",
          content: `An error occurred: ${error.message}`,
        }
        setHistory((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? { ...chat, messages: [...updatedMessages, errorMessage] }
              : chat
          )
        )
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full max-w-5xl">
       <div className="hidden md:flex flex-col w-64 border-r bg-background">
          <div className="p-2 flex flex-col gap-2">
            <Button
              onClick={createNewChat}
              className="w-full justify-start gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
             <Button
              variant="destructive"
              onClick={clearHistory}
              className="w-full justify-start gap-2"
              disabled={history.length === 0}
            >
              <Trash2 className="h-4 w-4" />
              Clear History
            </Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-1 p-2">
              {history.map((chat) => (
                 <div key={chat.id} className="group flex items-center gap-1">
                    <Button
                      variant={activeChatId === chat.id ? "secondary" : "ghost"}
                      className="w-full justify-start truncate"
                      onClick={() => setActiveChatId(chat.id)}
                    >
                      {chat.name}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(chat.id)
                        }}
                        >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
       </div>
       <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between p-4 border-b">
           <div className="md:hidden">
            <ChatHistory
              history={history}
              activeChatId={activeChatId}
              setActiveChatId={setActiveChatId}
              createNewChat={createNewChat}
              clearHistory={clearHistory}
              deleteChat={deleteChat}
            />
          </div>
          <h2 className="text-xl font-semibold truncate">{activeChat?.name ?? "Chat"}</h2>
          <Select
            value={activeChat?.modelId ?? defaultModel.id}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {chatModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ChatMessages messages={activeChat?.messages ?? []} isLoading={isLoading} />
        <ChatInput onSend={handleSend} isLoading={isLoading} onStop={handleStop} />
       </div>
    </div>
  );
}
