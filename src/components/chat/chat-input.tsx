"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, CornerDownLeft, Mic, StopCircle } from "lucide-react"

type ChatInputProps = {
  onSend: (message: string) => void
  isLoading: boolean
  onStop: () => void
}

export function ChatInput({ onSend, isLoading, onStop }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim())
      setMessage("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);


  return (
    <div className="relative flex-col w-full px-4 pt-4 bg-background">
      {isLoading && (
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          className="absolute left-1/2 -translate-x-1/2 -top-10"
        >
          <StopCircle className="mr-2 h-4 w-4" />
          Stop generating
        </Button>
      )}
      <div className="relative flex w-full items-start gap-2 rounded-lg border bg-card p-2">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message or use /imagine to generate an image..."
          className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
          rows={1}
          disabled={isLoading}
        />
        <Button onClick={handleSend} disabled={!message.trim() || isLoading}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground p-2">
        Type `/imagine &lt;prompt&gt;` to generate an image. Shift+Enter for a new line.
      </p>
    </div>
  )
}
