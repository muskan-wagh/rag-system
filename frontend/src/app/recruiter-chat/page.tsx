"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User } from "lucide-react"
import { sendChatMessage } from "@/lib/api"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function RecruiterChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your recruitment assistant. I can help you search for candidates, interpret ranking results, compare candidates, or give advice on job descriptions. What would you like to do?",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setLoading(true)

    try {
      const res = await sendChatMessage(userMsg)
      if (res.success && res.data) {
        setMessages((prev) => [...prev, { role: "assistant", content: res.data!.reply }])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't reach the server. Please check your connection." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 md:p-8 pt-6 max-w-3xl mx-auto w-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Recruiter Chat</h1>
        <p className="text-muted-foreground mt-1">Ask questions about candidates, rankings, or recruitment strategy.</p>
      </div>

      <Card className="flex-1 flex flex-col">
        <ScrollArea ref={scrollRef} className="flex-1 p-4 h-[500px]">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2.5 max-w-[80%] text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
                {msg.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg px-4 py-2.5 bg-muted text-sm text-muted-foreground animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
