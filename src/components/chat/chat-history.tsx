"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { History, Plus, Trash2 } from "lucide-react"

type ChatHistoryProps = {
  history: { id: string; name: string }[]
  activeChatId: string | null
  setActiveChatId: (id: string) => void
  createNewChat: () => void
  clearHistory: () => void
}

export function ChatHistory({
  history,
  activeChatId,
  setActiveChatId,
  createNewChat,
  clearHistory,
}: ChatHistoryProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-lg font-semibold">Chat History</SheetTitle>
        </SheetHeader>
        <div className="flex-1 flex flex-col">
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
                <Button
                  key={chat.id}
                  variant={activeChatId === chat.id ? "secondary" : "ghost"}
                  className="w-full justify-start truncate"
                  onClick={() => setActiveChatId(chat.id)}
                >
                  {chat.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
