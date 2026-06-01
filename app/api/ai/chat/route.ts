import { NextRequest } from "next/server";
import { generateGeminiText } from "@/lib/ai";
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
    const conversationText = `Chat messages:\n${messages
      .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
      .join("\n")}`;

    const text = await generateGeminiText(systemPrompt, conversationText, 1024);
    const assistantText = text || "";

    const lastUserMessage = [...messages].reverse().find((message: any) => message.role === "user");
    if (lastUserMessage?.content) {
      await prisma.chatMessage.create({
        data: {
          agentId: session.id,
          role: "user",
          content: lastUserMessage.content,
        },
      });
    }

    await prisma.chatMessage.create({
      data: {
        agentId: session.id,
        role: "assistant",
        content: assistantText,
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const data = JSON.stringify({ delta: assistantText });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[AI Chat Error]", error?.message || error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat", detail: error?.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
