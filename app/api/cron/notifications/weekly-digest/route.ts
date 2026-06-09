import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyDigestNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await sendWeeklyDigestNotifications();
    return NextResponse.json({ success: true, message: "Weekly digest notifications sent." }, { status: 200 });
  } catch (error: any) {
    console.error("Weekly digest error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
