"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Send, Loader2, Bot, User, Sparkles, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Message = { role: "user" | "assistant"; content: string; id: string; dir?: "rtl" | "ltr"; lang?: "ar" | "en" };

const SUGGESTED_PROMPTS_EN = [
  "What are the top investment areas in Dubai right now?",
  "How should I approach a T1 lead with UHNW signal?",
  "Write a follow-up email for a lead who didn't respond",
  "What is the average price per sqft in Palm Jumeirah?",
];
const SUGGESTED_PROMPTS_AR = [
  "ما هي أفضل مناطق الاستثمار في دبي حالياً؟",
  "كيف أتعامل مع عميل من الفئة الأولى؟",
  "اكتب رسالة متابعة لعميل لم يرد",
  "ما متوسط سعر القدم المربع في نخلة جميرا؟",
];

export default function AIChatPanel({ context }: { context?: string }) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language === "ar" ? "ar" : "en";
  const suggestions = lang === "ar" ? SUGGESTED_PROMPTS_AR : SUGGESTED_PROMPTS_EN;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/ai/chat");
        if (res.ok) {
          const history = await res.json();
          if (Array.isArray(history)) {
            setMessages(history.map((message) => {
              const isArabic = /[\u0600-\u06FF]/.test(message.content);
              return {
                role: message.role,
                content: message.content,
                id: `${message.role}-${Date.now()}-${Math.random()}`,
                dir: message.dir || (isArabic ? "rtl" : "ltr"),
                lang: message.lang || (isArabic ? "ar" : "en"),
              };
            }));
          }
        }
      } catch {
        // silently ignore history load failures; chat still works.
      }
    };

    loadHistory();
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const isUserMsgArabic = /[\u0600-\u06FF]/.test(content);
    const userMsg: Message = {
      role: "user",
      content,
      id: Date.now().toString(),
      dir: isUserMsgArabic ? "rtl" : "ltr",
      lang: isUserMsgArabic ? "ar" : "en",
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: "",
      id: assistantId,
      dir: "ltr",
      lang: "en",
    }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          lang,
          context,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Chat failed, please try again.";
        try {
          const json = JSON.parse(errorText);
          errorMessage = json.error || json.detail || errorText || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      if (!res.body) throw new Error("Chat failed: missing response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              accumulated += parsed.delta;
              const isAr = /[\u0600-\u06FF]/.test(accumulated);
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? {
                  ...m,
                  content: accumulated,
                  dir: parsed.dir || (isAr ? "rtl" : "ltr"),
                  lang: parsed.lang || (isAr ? "ar" : "en"),
                } : m)
              );
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || t("ai.chatError", "Chat failed, please try again"));
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setLoading(false);
    }
  };

  const copyMsg = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary)] to-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{t("ai.chat.title", "Brilliance AI Assistant")}</h2>
            <p className="text-[10px] text-blue-200">{t("ai.chat.subtitle", "UAE Real Estate Intelligence · Powered by Gemini")}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/ai/chat", { method: "DELETE" });
                if (res.ok) {
                  setMessages([]);
                }
              } catch {
                toast.error(t("ai.chatError", "Chat failed, please try again"));
              }
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            title={t("ai.chat.clear", "Clear chat")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6 h-full flex flex-col justify-center">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-[var(--color-primary)]" />
              </div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                {t("ai.chat.welcome", "How can I help you today?")}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("ai.chat.welcomeDesc", "Ask me anything about UAE real estate, leads, or market insights.")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="text-start px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-primary-subtle)] hover:border-[var(--color-primary)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
              )}
              <div className={`group relative max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                <div
                  dir={msg.dir}
                  lang={msg.lang}
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap text-start ${
                    msg.role === "user"
                      ? "bg-[var(--color-primary)] text-white rounded-br-sm"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-bl-sm"
                  }`}
                >
                  {msg.content || (loading && msg.role === "assistant" ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : "")}
                </div>
                {msg.content && msg.role === "assistant" && (
                  <button
                    onClick={() => copyMsg(msg.content, msg.id)}
                    className="absolute top-2 -inset-inline-end-7 opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-text-disabled)] hover:text-[var(--color-primary)] transition-all"
                  >
                    {copied === msg.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/50">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={t("ai.chat.placeholder", "Ask about leads, UAE market, or strategies...")}
            rows={1}
            className="flex-1 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none max-h-32"
            style={{ fieldSizing: "content" } as any}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 flex items-center justify-center bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-text-disabled)] text-center mt-2">
          {t("ai.chat.footer", "Powered by Gemini · Press Enter to send · Shift+Enter for new line")}
        </p>
      </div>
    </div>
  );
}
