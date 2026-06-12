import { NextRequest } from "next/server";
import { generateGeminiText, getAIConfig, generateGeminiStream, generateGeminiChatStream } from "@/lib/ai";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDailyBudget } from "@/lib/ai-gateway";

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
    return `أنت مستشار مبيعات عقاري ومحلل خبير في سوق العقارات الفاخرة بالإمارات. مهمتك مساعدة الوكيل العقاري بنصائح عملية فورية وبناءة مبنية على الحقائق فقط.
تلتزم بالقواعد التالية:
1. تجنب تماماً ديباجات الذكاء الاصطناعي العامة ومقدمات الرسائل العقيمة (مثل "أتمنى أن تكون بخير" أو "بصفتي ذكاء اصطناعي").
2. عندما يطلب الوكيل نصيحة للتواصل مع عميل محتمل، قدم إجابة مقسمة بوضوح إلى:
   - **المنظور الاستثماري للعميل**: لماذا قد يهتم بالاستثمار في الإمارات (بناءً على منصب العميل أو شركته أو إشاراته الاستثمارية).
   - **المنطقة والمشروع المقترح**: اقتراح مشروعات أو مناطق حقيقية تناسب فئته وميزانيته (مثال: نخلة جميرا أو وسط دبي للفئة الأولى، جزيرة ياس أو السعديات أو دبي لاند للميزانيات المتوسطة).
   - **نص التواصل الفوري**: كتابة نص رسالة (WhatsApp أو إيميل قصير) جاهز للإرسال مباشرة، يتميز بالاختصار والمهنية الراقية لجذب انتباه المستثمر.
3. التزم بالمهنية واللغة العربية الفصحى الراقية التي تليق بمخاطبة كبار المسؤولين ورجال الأعمال.
4. إذا سئلت عن معلومات غير متوفرة في السياق، لا تخترع أو تهلوس بأسماء أو أرقام، بل وضح ذلك بأمانة للوكيل.

${profileText}${context ? `السياق الحالي: ${context}\n\n` : ""}
أجب دائماً بالعربية ما لم يطلب المستخدم غير ذلك. كن دقيقاً ومفيداً وعملياً.`;
  }

  return `You are an elite real estate sales strategist and luxury market analyst in the UAE. Your mission is to provide immediate, constructive, and highly actionable advice to real estate agents based on factual data.
You MUST adhere to the following rules:
1. Avoid all generic AI preambles and boilerplate intro text (e.g. "I hope this email finds you well", "As an AI...", "Here is a pitch").
2. When the agent asks for advice on contacting a lead, structure your response clearly:
   - **Lead Investment Perspective:** Why they would invest in the UAE (leveraging their company, role, or signals).
   - **Recommended Match (Area/Project):** Propose real premium areas/projects matching their tier & budget (e.g. Palm Jumeirah or Downtown Dubai for T1 elite clients; Yas Island, Saadiyat, or Business Bay for premium/standard).
   - **Direct Outreach Script:** Provide a ready-to-use WhatsApp or brief email script that is direct, value-driven, and highly professional.
3. Avoid generic filler words. Write with premium business eloquence suited for high-ranking officials and global investors.
4. Do NOT hallucinate contact details, names, or metrics not present in the context. If details are missing, state so honestly.

${profileText}${context ? `Current context: ${context}\n\n` : ""}
Always respond in English unless the user writes in Arabic. Be precise, actionable, and professional.`;
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
    history.map((message: any) => {
      const isArabic = /[\u0600-\u06FF]/.test(message.content);
      return {
        role: message.role as "user" | "assistant",
        content: message.content,
        dir: isArabic ? "rtl" : "ltr",
        lang: isArabic ? "ar" : "en",
      };
    })
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

    const budget = await checkDailyBudget();
    if (budget.exceeded) {
      // Log technical details server-side only — never expose raw spend figures to the client
      console.warn(
        `[AI Chat] Daily budget exceeded: $${budget.currentSpend.toFixed(4)} / $${budget.limit.toFixed(2)}`
      );
      return new Response(
        JSON.stringify({
          error: "daily_budget_exceeded",
          message: "Daily AI usage limit has been reached. Please contact your system administrator."
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
    const body = await req.json();
    const { messages, lang = "en", context } = body;

    // Fast-fail when no AI provider is configured to avoid wasted work
    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      // Log env-specific detail server-side only
      console.warn('[AI Chat] request rejected: no AI provider configured (GOOGLE_AI_API_KEY / OPENAI_API_KEY missing)');
      return new Response(JSON.stringify({
        error: "ai_unavailable",
        message: "AI service is currently unavailable. Please contact your system administrator."
      }), {
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
    const rawStream = await generateGeminiChatStream(systemPrompt, recentMessages, 2048, req.signal);
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
          const isAr = /[\u0600-\u06FF]/.test(accumulatedText);
          const data = JSON.stringify({
            delta: value,
            dir: isAr ? "rtl" : "ltr",
            lang: isAr ? "ar" : "en",
          });
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
