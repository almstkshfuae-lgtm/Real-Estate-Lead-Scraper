import { NextRequest } from "next/server";
import { generateGeminiText, getAIConfig, generateGeminiStream, generateGeminiChatStream } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const buildSystemPrompt = (lang: string, context: string | undefined, user: { email: string; role: string; language?: string; name?: string; nameAr?: string | null } | null) => {
  const profileHints = [] as string[];
  if (user) {
    profileHints.push(`Agent email: ${user.email}`);
    profileHints.push(`Agent role: ${user.role}`);
    if (user.language) {
      profileHints.push(`Preferred language: ${user.language}`);
    }
    if (user.name) {
      profileHints.push(`Agent name: ${user.name}`);
    }
    if (user.nameAr) {
      profileHints.push(`Agent name (Arabic): ${user.nameAr}`);
    }
  }

  const profileText = profileHints.length > 0 ? `User profile:\n${profileHints.join("\n")}\n\n` : "";

  if (lang === "ar") {
    return `أنت مساعد ذكاء اصطناعي متخصص في سوق العقارات الإماراتي. تساعد وكلاء العقارات في:
- تحليل العملاء المحتملين وتقييم جاهزيتهم للشراء
- اقتراح استراتيجيات التواصل والمبيعات
- معلومات عن مناطق دبي وأبوظبي والشارقة وغيرها
- تحليل اتجاهات السوق العقاري الإماراتي
- صياغة رسائل ومقترحات احترافية
- تذكر سياق المحادثة وتتعلم من أسلوب المستخدم

${profileText}${context ? `السياق الحالي: ${context}\n\n` : ""}
أجب دائماً بالعربية ما لم يطلب المستخدم غير ذلك. كن دقيقاً ومفيداً وعملياً.
إذا لم تكن متأكدًا من معلومة، أعط إجابة واضحة مع تأكيد بعدم توفر التفاصيل بدلاً من التخمين.`;
  }

  return `You are an AI assistant specialized in the UAE real estate market. You help real estate agents with:
- Analyzing leads and evaluating purchase readiness
- Suggesting contact and sales strategies
- Information about Dubai, Abu Dhabi, Sharjah, and other UAE areas
- UAE real estate market trends and analysis
- Crafting professional messages and proposals
- Lead scoring interpretation and next steps
- Remember the conversation context and learn from the user's style

${profileText}${context ? `Current context: ${context}\n\n` : ""}
Always respond in English unless the user writes in Arabic. Be precise, actionable, and professional.
If you are unsure, say that you need more information rather than guessing.`;
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history = await prisma.chatMessage.findMany({
    where: { agentId: session.id },
    orderBy: { createdAt: "asc" },
  });

  return new Response(JSON.stringify(
    history.map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
  ), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await prisma.chatMessage.deleteMany({ where: { agentId: session.id } });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const { messages, lang = "en", context } = body;

    // Fast-fail when no AI provider is configured to avoid wasted work
    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      console.warn('[AI Chat] request rejected: no AI provider configured');
      return new Response(JSON.stringify({ error: 'AI provider not configured. Set GOOGLE_AI_API_KEY or OPENAI_API_KEY.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.info('[AI Chat] POST request starting stream', { agentId: session.id, messagesCount: Array.isArray(messages) ? messages.length : 0, lang });

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true, role: true, language: true, name: true, nameAr: true },
    });

    const systemPrompt = buildSystemPrompt(lang, context, user);
    
    // Apply sliding window of last 15 messages to manage context length
    const maxHistory = 15;
    const recentMessages = messages.slice(-maxHistory);

    // Get the live stream from Gemini using the native chat format and system instruction
    const rawStream = await generateGeminiChatStream(systemPrompt, recentMessages, 4096, req.signal);
    const reader = rawStream.getReader();
    const encoder = new TextEncoder();

    // Save the user message to chat history immediately
    const lastUserMessage = [...messages].reverse().find((message: any) => message.role === "user");
    if (lastUserMessage?.content) {
      try {
        await prisma.chatMessage.create({
          data: {
            agentId: session.id,
            role: "user",
            content: lastUserMessage.content,
          },
        });
      } catch (dbErr) {
        console.error('[AI Chat] failed to save user message', (dbErr as Error).message);
      }
    }

    let accumulatedText = "";

    const stream = new ReadableStream({
      async start(controller) {
        // Handle abort event explicitly to close reader cleanly
        req.signal.addEventListener('abort', () => {
          console.info('[AI Chat] connection aborted by client, terminating stream reader.');
          reader.cancel("Aborted").catch(() => {});
          try {
            controller.close();
          } catch {}
        });
      },
      async pull(controller) {
        try {
          if (req.signal.aborted) {
            controller.close();
            return;
          }

          const { done, value } = await reader.read();
          if (done) {
            // Save the assistant's full reply to the database history once fully generated
            if (accumulatedText.trim()) {
              try {
                await prisma.chatMessage.create({
                  data: {
                    agentId: session.id,
                    role: "assistant",
                    content: accumulatedText,
                  },
                });
              } catch (dbErr) {
                console.error('[AI Chat] failed to save assistant message to DB', (dbErr as Error).message);
              }
            }

            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          accumulatedText += value;
          const data = JSON.stringify({ delta: value });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (err: any) {
          if (req.signal.aborted || err.name === 'AbortError') {
            console.info('[AI Chat] streaming fetch request aborted during read loop.');
          } else {
            console.error('[AI Chat] error during stream reading:', err);
            controller.error(err);
          }
          try {
            controller.close();
          } catch {}
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.info('[AI Chat] POST request aborted during pre-stream setup.');
      return new Response(JSON.stringify({ error: "Request aborted" }), { status: 499 });
    }
    console.error("[AI Chat Error]", error?.message || error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat", detail: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
