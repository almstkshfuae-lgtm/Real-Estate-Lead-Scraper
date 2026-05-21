import { NextRequest } from "next/server";
import { generateGeminiText } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, lang = "en", context } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const systemPrompt =
      lang === "ar"
        ? `أنت مساعد ذكاء اصطناعي متخصص في سوق العقارات الإماراتي. تساعد وكلاء العقارات في:
- تحليل العملاء المحتملين وتقييم جاهزيتهم للشراء
- اقتراح استراتيجيات التواصل والمبيعات
- معلومات عن مناطق دبي وأبوظبي والشارقة وغيرها
- تحليل اتجاهات السوق العقاري الإماراتي
- صياغة رسائل ومقترحات احترافية

${context ? `السياق الحالي: ${context}` : ""}

أجب دائماً بالعربية ما لم يطلب المستخدم غير ذلك. كن دقيقاً ومفيداً وعملياً.`
        : `You are an AI assistant specialized in the UAE real estate market. You help real estate agents with:
- Analyzing leads and evaluating purchase readiness
- Suggesting contact and sales strategies
- Information about Dubai, Abu Dhabi, Sharjah, and other UAE areas
- UAE real estate market trends and analysis
- Crafting professional messages and proposals
- Lead scoring interpretation and next steps

${context ? `Current context: ${context}` : ""}

Always respond in English unless the user writes in Arabic. Be precise, actionable, and professional.`;

    // Build the stream response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const text = await generateGeminiText(
            systemPrompt,
            `Chat messages:\n${messages
              .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
              .join("\n")}`,
            1024
          );

          const data = JSON.stringify({ delta: text || "" });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err: any) {
          const errorData = JSON.stringify({ error: err?.message || "Stream error" });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
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
