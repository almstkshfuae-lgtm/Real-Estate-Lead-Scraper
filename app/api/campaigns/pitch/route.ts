import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText, getAIConfig } from "@/lib/ai";
import { getSession } from "@/lib/auth";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { groupBy = "propertyType", groupKey, lang = "en", tone = "professional" } = body;

    if (!groupKey) {
      return NextResponse.json({ error: "Group key is required" }, { status: 400 });
    }

    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Go to Settings → Integrations and add your Google AI API key." },
        { status: 503 }
      );
    }

    const isArabic = lang === "ar";
    const segmentName = groupKey.toLowerCase() === "unknown" ? "real estate" : groupKey;

    const systemPrompt = isArabic
      ? `أنت مساعد مبيعات عقارات متطور في دولة الإمارات العربية المتحدة. 
مهمتك هي إنشاء قالب رسالة ترويجية عقارية مخصصة وجذابة للغاية مخصصة للمستثمرين.
يجب أن تحتوي الرسالة على المتغيرات التالية كعناصر نائبة (مكتوبة تماماً كما يلي):
- {{name}} لاسم العميل.
- {{company}} لاسم شركة العميل.
- {{location}} لمنطقة الاستثمار المفضلة للعميل.

القواعد الصارمة:
1. يجب أن تكون الرسالة باللغة العربية الفصحى فقط.
2. لا تستخدم مقدمات مبتذلة مثل "عزيزي" أو "أتمنى أن تكون بخير". ابدأ مباشرة بفكرة قوية ومثيرة للاهتمام.
3. ركز على فئة العميل المستهدفة: ${groupBy === "tier" ? `الفئة ${segmentName}` : `نوع العقار: ${segmentName}`}.
4. يجب أن تكون الرسالة مناسبة للإرسال عبر البريد الإلكتروني أو الواتساب (3 إلى 4 جمل كحد أقصى).
5. أرجع النص مباشرة بدون أي نص إضافي أو عناوين.`
      : `You are an elite UAE real estate sales assistant.
Your task is to write a highly compelling, personalized real estate campaign pitch template.
The template MUST contain the following exact placeholders:
- {{name}} for the client's name.
- {{company}} for the client's company.
- {{location}} for the client's preferred target investment location.

Strict Rules:
1. Write the pitch template in English.
2. Never start with cliches like "Hope you are doing well" or "Dear". Hook the reader immediately.
3. Tailor the content specifically to this lead segment: ${groupBy === "tier" ? `Tier ${segmentName} leads` : `${segmentName} property interest segment`}.
4. Keep the template concise, data-driven, and brief (3-4 sentences max), perfect for WhatsApp or Email.
5. Return ONLY the template text. No extra labels or preamble.`;

    const userPrompt = isArabic
      ? `أنشئ قالب رسالة ترويجية لـ:
التقسيم: ${groupBy === "tier" ? `العملاء من الفئة ${segmentName}` : `العملاء المهتمين بـ ${segmentName}`}
الأسلوب: ${tone === "formal" ? "رسمي واحترافي للغاية" : tone === "casual" ? "ودي ومباشر" : "احترافي ومتزن"}

تذكر تضمين العناصر النائبة {{name}} و {{company}} و {{location}} بشكل طبيعي في القالب.`
      : `Create a campaign pitch template for:
Segment: ${groupBy === "tier" ? `Tier ${segmentName} leads` : `Leads interested in ${segmentName} properties`}
Tone: ${tone === "formal" ? "Very formal and corporate" : tone === "casual" ? "Friendly and warm" : "Professional and balanced"}

Remember to include the placeholders {{name}}, {{company}}, and {{location}} naturally within the text.`;

    const templateText = await generateGeminiText(systemPrompt, userPrompt, 512, undefined, 'pitch', session.id);

    return NextResponse.json({ template: templateText || "" });
  } catch (error: any) {
    console.error("[Campaign Pitch API Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate campaign pitch template", detail: error?.message },
      { status: 500 }
    );
  }
}
