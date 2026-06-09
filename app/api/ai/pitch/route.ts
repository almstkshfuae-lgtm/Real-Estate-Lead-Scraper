import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText, getAIConfig } from "@/lib/ai";
import { signalsToString } from "@/lib/signals";
import { getSession } from "@/lib/auth";

// Allow up to 30s — Gemini API calls can take 10-15s on cold start
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { lead, lang = "en", style = "professional" } = body;

    if (!lead) {
      return NextResponse.json({ error: "Lead data is required" }, { status: 400 });
    }

    // Check API key before calling Gemini — return clear 503 instead of cryptic 500
    const aiConfig = await getAIConfig();
    if (!aiConfig) {
      return NextResponse.json(
        { error: "Gemini API key not configured. Go to Settings → Integrations and add your Google AI API key." },
        { status: 503 }
      );
    }

    const systemPrompt =
      lang === "ar"
        ? `أنت مساعد مبيعات عقارات متخصص في الإمارات العربية المتحدة. تكتب عروض مبيعات احترافية ومخصصة باللغة العربية فقط. أسلوبك: موجز، مقنع، ومناسب لكبار المستثمرين والعملاء من ذوي الثروات العالية. هام جداً: العميل هو مستثمر رفيع المستوى قد يكون مقيماً في أي دولة حول العالم (مثل كندا، أوروبا، إلخ). المنطقة المفضلة لديه هي منطقة مستهدفة للاستثمار العقاري داخل الإمارات، فلا تفترض أو تدعي أبداً أنه مقيم محلياً في الإمارات أو في تلك المنطقة، بل خاطبه كمستثمر خارجي/دولي يتطلع لاقتناص فرصة مميزة في الإمارات لتوسيع محفظته العقارية.
ممنوع تماماً البدء بعبارات مثل "أتمنى أن تكون بخير" أو "نحن سعداء بالاتصال بك" أو "عزيزي". ابدأ العرض مباشرة بجملة افتتاحية قوية تركز على القيمة والأعمال (مثل: "بالنظر إلى ريادتكم في مجال..." أو "بصفتكم مستثمراً دولياً..."). لا تذكر أسعاراً محددة إلا إذا أُعطيت. لا تستخدم تعبيرات مبالغ فيها. يجب أن تكون جميع الردود باللغة العربية الفصحى فقط.`
        : `You are an elite UAE real estate sales assistant specializing in high-net-worth client engagement. Write highly personalized, professional property pitch emails in English. Style: concise, data-driven, luxury-focused. CRITICAL: The lead is a high-profile global investor who may reside anywhere in the world (e.g., Canada, Europe). The "Preferred Area" is their target investment zone in the UAE, NOT their residence. Never assume or write that they currently reside in the UAE or the target area; instead, pitch the UAE opportunity as a premium addition to their international portfolio.
STRICTLY FORBIDDEN to use cliches like "Hope this email finds you well", "We are pleased to...", or starting with "Dear". Start the pitch directly with a compelling business-focused hook (e.g., "Given your leadership at...", "As a global investor expanding your portfolio..."). Never include specific prices unless given. Avoid generic phrases. Output only the pitch text in English, no subject line, no labels.`;

    const signals = signalsToString(lead.signals);

    const nameVal = lang === "ar" ? (lead.nameAr || lead.name) : lead.name;
    const companyVal = lang === "ar" ? (lead.companyAr || lead.company) : lead.company;
    const roleVal = lang === "ar" ? (lead.roleAr || lead.role) : lead.role;

    const userPrompt =
      lang === "ar"
        ? `اكتب عرض مبيعات قصير ومخصص (3-4 جمل) باللغة العربية حصراً لـ:
الاسم: ${nameVal}
الشركة: ${companyVal}
المنصب: ${roleVal}
درجة الاستثمار: ${lead.score}/100
الفئة: ${lead.tier === 1 ? "نخبة (T1)" : lead.tier === 2 ? "مميز (T2)" : "قياسي (T3)"}
إشارات الاستثمار: ${signals}
الميزانية: ${lead.budgetMin ? `${lead.budgetMin.toLocaleString()} - ${lead.budgetMax?.toLocaleString()} درهم` : "غير محددة"}
المنطقة المستهدفة للاستثمار: ${lead.location || "الإمارات"} (ملاحظة هامة جداً: العميل مستثمر دولي، لا تفترض أو تذكر في العرض أنه مقيم هناك حالياً)

الأسلوب: ${style === "formal" ? "رسمي جداً" : style === "casual" ? "ودي ومريح" : "احترافي ومتزن"}

اكتب العرض باللغة العربية مباشرة بدون مقدمات أو هوامش إضافية:`
        : `Write a short personalized pitch (3-4 sentences) in English for:
Name: ${nameVal}
Company: ${companyVal}
Role: ${roleVal}
Investment Score: ${lead.score}/100
Tier: ${lead.tier === 1 ? "Elite (T1)" : lead.tier === 2 ? "Premium (T2)" : "Standard (T3)"}
Investment Signals: ${signals}
Budget: ${lead.budgetMin ? `AED ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax?.toLocaleString()}` : "Not specified"}
Target Investment Area: ${lead.location || "UAE"} (CRITICAL Note: The client is an international/external investor, do NOT assume or write that they live there currently)

Tone: ${style === "formal" ? "Very formal and corporate" : style === "casual" ? "Friendly and warm" : "Professional and balanced"}

Write the pitch in English directly without any preamble or extra labels:`;

    const pitchText = await generateGeminiText(systemPrompt, userPrompt, 512, undefined, 'pitch', session.id);

    return NextResponse.json({ pitch: pitchText || "", tokens: null });
  } catch (error: any) {
    console.error("[AI Pitch Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate pitch", detail: error?.message },
      { status: 500 }
    );
  }
}
