"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquarePlus, Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toApiError } from "@/lib/api/client";
import { aiService, type ChatMessageRow } from "@/lib/api/learning-ai";
import { isModuleDisabled, ModuleDisabled } from "../shared";

export function VBuddyPage() {
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const suggestions = useQuery({ queryKey: ["vbuddy-suggestions"], queryFn: aiService.suggestions });
  const history = useQuery({ queryKey: ["vbuddy-conversations"], queryFn: aiService.conversations });

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useMutation({
    mutationFn: (text: string) => aiService.chat(text, conversationId),
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setMessages((m) => [...m, r.message]);
      qc.invalidateQueries({ queryKey: ["vbuddy-conversations"] });
    },
    onError: (e) => {
      toast.error(toApiError(e).message);
      setMessages((m) => m.slice(0, -1));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => aiService.removeConversation(id),
    onSuccess: (_d, id) => {
      if (id === conversationId) startNew();
      qc.invalidateQueries({ queryKey: ["vbuddy-conversations"] });
    },
    onError: (e) => toast.error(toApiError(e).message),
  });

  const startNew = () => {
    setConversationId(undefined);
    setMessages([]);
  };
  const open = async (id: string) => {
    try {
      const c = await aiService.conversation(id);
      setConversationId(id);
      setMessages(c.messages);
    } catch (e) {
      toast.error(toApiError(e).message);
    }
  };
  const submit = (text: string) => {
    const t = text.trim();
    if (!t || send.isPending) return;
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", content: t }]);
    setDraft("");
    send.mutate(t);
  };

  const disabled = [suggestions.error, history.error, send.error].some(isModuleDisabled);
  if (disabled) return <div><PageHeader title="V Buddy" /><ModuleDisabled name="V Buddy" /></div>;

  return (
    <div>
      <PageHeader title="V Buddy" description="Your study companion. Ask anything about your lessons." actions={<Button variant="outline" onClick={startNew}><MessageSquarePlus className="size-4" aria-hidden /> New chat</Button>} />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Conversation history" className="order-2 rounded-2xl border bg-card p-3 shadow-sm lg:order-1">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h2>
          {history.isLoading ? (
            <p className="px-1 text-sm text-muted-foreground" role="status">Loading…</p>
          ) : history.data?.length ? (
            <ul className="space-y-1">
              {history.data.map((c) => (
                <li key={c.id} className="group flex items-center gap-1">
                  <button type="button" onClick={() => open(c.id)} aria-current={c.id === conversationId} className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted ${c.id === conversationId ? "bg-muted font-medium" : ""}`}>{c.title}</button>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={`Delete conversation ${c.title}`} onClick={() => remove.mutate(c.id)}><Trash2 className="size-3.5" /></Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">No conversations yet.</p>
          )}
        </nav>

        <section aria-label="Chat" className="order-1 flex h-[70vh] min-h-96 flex-col rounded-2xl border bg-card shadow-sm lg:order-2">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Bot className="size-6" aria-hidden /></span>
                <p className="font-medium">How can I help you study today?</p>
                <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                  {suggestions.data?.map((s) => (
                    <Button key={s} size="sm" variant="outline" className="h-auto whitespace-normal rounded-full py-1.5 text-left" onClick={() => submit(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <span className="sr-only">{m.role === "user" ? "You: " : "V Buddy: "}</span>{m.content}
                  </p>
                </div>
              ))
            )}
            {send.isPending && <p className="text-sm text-muted-foreground" role="status">V Buddy is thinking…</p>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
            <label htmlFor="vbuddy-input" className="sr-only">Message V Buddy</label>
            <Textarea
              id="vbuddy-input" rows={1} value={draft} placeholder="Ask a question…" className="min-h-9 resize-none"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(draft); } }}
            />
            <Button type="submit" size="icon-lg" aria-label="Send message" disabled={!draft.trim() || send.isPending}><Send className="size-4" /></Button>
          </form>
        </section>
      </div>
    </div>
  );
}
