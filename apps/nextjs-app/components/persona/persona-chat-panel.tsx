"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, Trash2, Send, Plus, Loader2 } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/apps/nextjs-app/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/apps/nextjs-app/components/ui/dialog";
import { ScrollArea } from "@/apps/nextjs-app/components/ui/scroll-area";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/apps/nextjs-app/components/ui/tooltip";
import {
  getPersonaChatHistory,
  clearPersonaChat,
  createPersonaFaqItem,
  type PersonaChatMessage,
} from "@/apps/nextjs-app/lib/actions/persona-chat-actions";
import Markdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  isStreaming?: boolean;
}

interface PersonaChatPanelProps {
  personaGroupId: string;
  personaStudyId: string;
  personaName?: string;
  photoUrl?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PersonaChatPanel({
  personaGroupId,
  personaStudyId,
  personaName,
  photoUrl,
  open,
  onOpenChange,
}: PersonaChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [addToFaqMessage, setAddToFaqMessage] = useState<ChatMessage | null>(
    null,
  );
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [isSavingFaq, setIsSavingFaq] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [faqAddedMessageIds, setFaqAddedMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    setIsLoading(true);
    try {
      const result = await getPersonaChatHistory(personaGroupId);
      if (result.success) {
        setMessages(
          result.data.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      }
    } finally {
      setIsLoading(false);
      setHistoryLoaded(true);
    }
  }, [personaGroupId, historyLoaded]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content: trimmed,
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "ASSISTANT",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/persona/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaGroupId,
          studyId: personaStudyId,
          message: trimmed,
        }),
      });

      if (!res.ok || !res.body) {
        const errorText = await res.text().catch(() => "Unknown error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: "Sorry, I couldn't respond. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: accumulated, isStreaming: true }
              : m,
          ),
        );
      }

      // Finalize the streaming message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: accumulated, isStreaming: false }
            : m,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? {
                ...m,
                content: "Sorry, something went wrong. Please try again.",
                isStreaming: false,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }, [inputValue, isStreaming, personaGroupId, personaStudyId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClearChat = useCallback(async () => {
    setClearConfirmOpen(false);
    const result = await clearPersonaChat(personaGroupId, personaStudyId);
    if (result.success) {
      setMessages([]);
      setHistoryLoaded(false);
    }
  }, [personaGroupId, personaStudyId]);

  const handleAddToFaq = useCallback(
    (msg: ChatMessage) => {
      // Try to find the preceding user message as the question
      const idx = messages.findIndex((m) => m.id === msg.id);
      const preceding = idx > 0 ? messages[idx - 1] : null;
      setFaqQuestion(preceding?.role === "USER" ? preceding.content : "");
      setFaqAnswer(msg.content);
      setAddToFaqMessage(msg);
    },
    [messages],
  );

  const handleSaveFaq = useCallback(async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    setIsSavingFaq(true);
    try {
      const result = await createPersonaFaqItem(
        personaGroupId,
        faqQuestion.trim(),
        faqAnswer.trim(),
        personaStudyId,
      );
      if (result.success) {
        setFaqAddedMessageIds((prev) => new Set(prev).add(addToFaqMessage!.id));
        setAddToFaqMessage(null);
        router.refresh();
      }
    } finally {
      setIsSavingFaq(false);
    }
  }, [
    faqQuestion,
    faqAnswer,
    personaGroupId,
    personaStudyId,
    addToFaqMessage,
    router,
  ]);

  const displayName = personaName ?? "Persona";

  return (
    <>
      {/* Chat sheet */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 focus:outline-none sm:max-w-md [&>button:last-child]:hidden"
        >
          <SheetHeader className="flex flex-row items-center border-b px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={displayName}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-600">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <SheetTitle className="truncate text-sm font-semibold">
                Chat with {displayName}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setClearConfirmOpen(true)}
                aria-label="Clear chat history"
                title="Clear chat"
                disabled={messages.length === 0}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Messages */}
          <div className="relative flex-1 overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-linear-to-b from-white to-transparent dark:from-zinc-900" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-linear-to-t from-white to-transparent dark:from-zinc-900" />
            <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-4">
              {isLoading && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-zinc-500">
                  <MessageSquare className="h-8 w-8 text-zinc-300" />
                  <p className="font-medium">Start a conversation</p>
                  <p className="text-xs">
                    Ask {displayName} anything about their experience, needs, or
                    opinions.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col gap-1 ${msg.role === "USER" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "USER"
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-900"
                        }`}
                      >
                        {msg.role === "ASSISTANT" ? (
                          msg.isStreaming && !msg.content ? (
                            <div className="flex items-center gap-1 py-0.5">
                              <span className="h-1.5 w-1.5 animate-[bounce_0.8s_ease-in-out_infinite] rounded-full bg-zinc-400" />
                              <span className="h-1.5 w-1.5 animate-[bounce_0.8s_ease-in-out_infinite_0.15s] rounded-full bg-zinc-400" />
                              <span className="h-1.5 w-1.5 animate-[bounce_0.8s_ease-in-out_infinite_0.3s] rounded-full bg-zinc-400" />
                            </div>
                          ) : (
                            <Markdown
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0">{children}</p>
                                ),
                                ul: ({ children }) => (
                                  <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">
                                    {children}
                                  </ol>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold">
                                    {children}
                                  </strong>
                                ),
                              }}
                            >
                              {msg.content}
                            </Markdown>
                          )
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === "ASSISTANT" &&
                        !msg.isStreaming &&
                        msg.content && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <button
                                    onClick={() => handleAddToFaq(msg)}
                                    disabled={faqAddedMessageIds.has(msg.id)}
                                    className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Add this response to FAQ"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Add to FAQ
                                  </button>
                                </span>
                              </TooltipTrigger>
                              {faqAddedMessageIds.has(msg.id) && (
                                <TooltipContent>
                                  <p>Already added to FAQ</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Input area */}
          <div className="flex items-end gap-2 px-4 py-3">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask ${displayName}…`}
              className="max-h-32 min-h-10 resize-none text-sm"
              rows={1}
              disabled={isStreaming}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming}
              aria-label="Send message"
              className="h-10 w-10 shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add to FAQ dialog */}
      <Dialog
        open={!!addToFaqMessage}
        onOpenChange={(open) => !open && setAddToFaqMessage(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add to FAQ</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Question
              </label>
              <Textarea
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                placeholder="Enter the question…"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Answer
              </label>
              <Textarea
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                placeholder="Enter the answer…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToFaqMessage(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveFaq}
              disabled={!faqQuestion.trim() || !faqAnswer.trim() || isSavingFaq}
            >
              {isSavingFaq ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save to FAQ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear chat confirmation dialog */}
      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear chat history?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-500">
            This will permanently delete your entire conversation with{" "}
            {displayName}. This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClearChat}>
              Clear chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface PersonaChatTriggerProps {
  personaGroupId: string;
  personaStudyId: string;
  personaName?: string;
  photoUrl?: string | null;
}

export function PersonaChatTrigger(props: PersonaChatTriggerProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setOpen(true)}
              aria-label={`Chat with ${props.personaName ?? "Persona"}`}
            >
              <MessageSquare className="h-4 w-4 text-zinc-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ask</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PersonaChatPanel {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}
