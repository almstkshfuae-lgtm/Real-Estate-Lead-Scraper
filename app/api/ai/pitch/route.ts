import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lead, lang = "en", style = "professional" } = body;

    if (!lead) {
      return NextResponse.json({ error: "Lead data is required" }, { status: 400 });
    }

    const systemPrompt =
      lang === "ar"
        ? `أنت مساعد مبيعات عقارات متخصص في الإمارات العربية المتحدة. تكتب عروض مبيعات احترافية ومخصصة باللغة العربية. أسلوبك: موجز، مقنع، ومناسب لكبار المستثمرين والعملاء من ذوي الثروات العالية. لا تذكر أسعاراً محددة إلا إذا أُعطيت. لا تستخدم تعبيرات مبالغ فيها.`
        : `You are an elite UAE real estate sales assistant specializing in high-net-worth client engagement. Write highly personalized, professional property pitch emails. Style: concise, data-driven, luxury-focused. Never include specific prices unless given. Avoid generic phrases. Output only the pitch text, no subject line, no labels.`;

    const signals = Array.isArray(lead.signals) ? lead.signals.join(", ") : lead.signals || "N/A";

    const userPrompt =
      lang === "ar"
        ? `اكتب عرض مبيعات قصير ومخصص (3-4 جمل) لـ:
الاسم: ${lead.name}
الشركة: ${lead.company}
المنصب: ${lead.role}
درجة الاستثمار: ${lead.score}/100
الفئة: ${lead.tier === 1 ? "نخبة (T1)" : lead.tier === 2 ? "مميز (T2)" : "قياسي (T3)"}
إشارات الاستثمار: ${signals}
الميزانية: ${lead.budgetMin ? `${lead.budgetMin.toLocaleString()} - ${lead.budgetMax?.toLocaleString()} درهم` : "غير محددة"}
المنطقة المفضلة: ${lead.location || "الإمارات"}

الأسلوب: ${style === "formal" ? "رسمي جداً" : style === "casual" ? "ودي ومريح" : "احترافي ومتزن"}

اكتب العرض مباشرة بدون مقدمات:`
        : `Write a short personalized pitch (3-4 sentences) for:
Name: ${lead.name}
Company: ${lead.company}
Role: ${lead.role}
Investment Score: ${lead.score}/100
Tier: ${lead.tier === 1 ? "Elite (T1)" : lead.tier === 2 ? "Premium (T2)" : "Standard (T3)"}
Investment Signals: ${signals}
Budget: ${lead.budgetMin ? `AED ${lead.budgetMin.toLocaleString()} - ${lead.budgetMax?.toLocaleString()}` : "Not specified"}
Preferred Area: ${lead.location || "UAE"}

Tone: ${style === "formal" ? "Very formal and corporate" : style === "casual" ? "Friendly and warm" : "Professional and balanced"}

Write the pitch directly without any preamble:`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const pitchText =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ pitch: pitchText, tokens: message.usage });
  } catch (error: any) {
    console.error("[AI Pitch Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to generate pitch", detail: error?.message },
      { status: 500 }
    );
  }
}
