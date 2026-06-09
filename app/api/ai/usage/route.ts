import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkDailyBudget } from "@/lib/ai-gateway";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow admins to view system-wide AI usage
    if (session.role?.toUpperCase() !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // 1. Today's stats
    const todayLogs = await prisma.aiUsageLog.aggregate({
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCostUsd: true,
      },
      where: {
        createdAt: { gte: todayStart },
      },
    });

    const todayStats = {
      promptTokens: todayLogs._sum.promptTokens || 0,
      completionTokens: todayLogs._sum.completionTokens || 0,
      totalTokens: todayLogs._sum.totalTokens || 0,
      estimatedCostUsd: todayLogs._sum.estimatedCostUsd || 0,
    };

    // 2. Budget status
    const budget = await checkDailyBudget();

    // 3. Last 7 days daily breakdown
    const dailyBreakdownRaw = await prisma.$queryRaw<
      Array<{
        date: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
      }>
    >`
      SELECT 
        DATE_FORMAT(createdAt, '%Y-%m-%d') as date,
        CAST(SUM(promptTokens) AS SIGNED) as promptTokens,
        CAST(SUM(completionTokens) AS SIGNED) as completionTokens,
        CAST(SUM(totalTokens) AS SIGNED) as totalTokens,
        SUM(estimatedCostUsd) as estimatedCostUsd
      FROM ai_usage_logs
      WHERE createdAt >= ${sevenDaysAgo}
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m-%d')
      ORDER BY date ASC
    `;

    // 4. Per-task-type breakdown (last 7 days)
    const taskBreakdownRaw = await prisma.aiUsageLog.groupBy({
      by: ["taskType"],
      _sum: {
        totalTokens: true,
        estimatedCostUsd: true,
      },
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    const taskBreakdown = taskBreakdownRaw.map((t) => ({
      taskType: t.taskType,
      totalTokens: t._sum.totalTokens || 0,
      estimatedCostUsd: t._sum.estimatedCostUsd || 0,
    }));

    return NextResponse.json({
      today: todayStats,
      budget: {
        exceeded: budget.exceeded,
        currentSpend: budget.currentSpend,
        limit: budget.limit,
      },
      daily: dailyBreakdownRaw.map(row => ({
        ...row,
        promptTokens: Number(row.promptTokens),
        completionTokens: Number(row.completionTokens),
        totalTokens: Number(row.totalTokens),
        estimatedCostUsd: Number(row.estimatedCostUsd || 0),
      })),
      tasks: taskBreakdown,
    });
  } catch (error: any) {
    console.error("[AI Usage API Error]", error);
    return NextResponse.json({ error: "Internal Server Error", detail: error.message }, { status: 500 });
  }
}
