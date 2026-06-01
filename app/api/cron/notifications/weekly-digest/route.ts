import { NextResponse } from "next/server";
import { sendWeeklyDigestNotifications } from "@/lib/notifications";

export async function GET() {
  try {
    await sendWeeklyDigestNotifications();
    return NextResponse.json({ success: true, message: "Weekly digest notifications sent." }, { status: 200 });
  } catch (error: any) {
    console.error("Weekly digest error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
