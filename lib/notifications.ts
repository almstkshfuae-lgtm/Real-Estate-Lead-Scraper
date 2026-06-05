import prisma from "@/lib/prisma";
import { parsePreferences } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";
import { sendWhatsAppText } from "@/lib/whatsapp";

export type NotificationPreferences = {
  emailAlerts: boolean;
  pushNotifications: boolean;
  whatsappAlerts: boolean;
  whatsappPhoneNumber?: string;
  newLeadAlerts: boolean;
  scrapeCompletion: boolean;
  weeklyDigest: boolean;
};

export type IntegrationPreferences = {
  smtpHost?: string;
  smtpUser?: string;
  smtpPass?: string;
  whatsappPhoneId?: string;
  whatsappToken?: string;
};

export const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  pushNotifications: false,
  whatsappAlerts: false,
  whatsappPhoneNumber: "",
  newLeadAlerts: true,
  scrapeCompletion: true,
  weeklyDigest: false,
};

export function getNotificationPreferences(preferences: any): NotificationPreferences {
  const parsed = parsePreferences(preferences);
  const notifications = parsed?.notifications ?? (parsed?.emailAlerts !== undefined ? parsed : {});
  return {
    ...defaultNotificationPrefs,
    ...notifications,
  };
}

export function getIntegrationPreferences(preferences: any): IntegrationPreferences {
  const parsed = parsePreferences(preferences);
  return parsed?.integrations ?? {};
}

export async function createNotificationRecord(
  agentId: string,
  title: string,
  body: string,
  type: string = "info",
  data?: any
) {
  return prisma.notification.create({
    data: {
      agentId,
      title,
      body,
      type,
      data: data ? JSON.stringify(data) : null,
    },
  });
}

export async function sendAgentNotification(
  agentId: string,
  eventType: "newLead" | "scrapeComplete" | "weeklyDigest",
  title: string,
  body: string,
  data?: any
) {
  const user = await prisma.user.findUnique({
    where: { id: agentId },
  });

  if (!user) {
    console.warn(`Cannot send notification: user ${agentId} not found.`);
    return;
  }

  const prefs = getNotificationPreferences(user.preferences);
  const integrations = getIntegrationPreferences(user.preferences);

  if (eventType === "newLead" && !prefs.newLeadAlerts) return;
  if (eventType === "scrapeComplete" && !prefs.scrapeCompletion) return;
  if (eventType === "weeklyDigest" && !prefs.weeklyDigest) return;

  const promises: Promise<any>[] = [];

  if (prefs.pushNotifications) {
    promises.push(createNotificationRecord(agentId, title, body, eventType, data));
  }

  if (prefs.emailAlerts) {
    const { smtpHost, smtpUser, smtpPass } = integrations;
    if (smtpHost && smtpUser && smtpPass && user.email) {
      promises.push(
        sendEmail({
          host: smtpHost,
          port: 587,
          secure: false,
          user: smtpUser,
          pass: smtpPass,
          from: `Brilliance <${smtpUser}>`,
          to: user.email,
          subject: title,
          text: body,
        })
      );
    } else {
      console.warn(`Email notification skipped for ${agentId}: SMTP is not configured or user email is missing.`);
    }
  }

  if (prefs.whatsappAlerts) {
    const { whatsappPhoneId, whatsappToken } = integrations;
    const target = prefs.whatsappPhoneNumber?.trim();
    if (whatsappPhoneId && whatsappToken && target) {
      promises.push(sendWhatsAppText(whatsappPhoneId, whatsappToken, target, `${title}\n\n${body}`));
    } else {
      console.warn(`WhatsApp notification skipped for ${agentId}: WhatsApp settings or phone number are missing.`);
    }
  }

  await Promise.allSettled(promises);
}

export async function notifyNewEliteLeads(agentId: string, tierOneCount: number, runId?: string) {
  if (tierOneCount <= 0) return;
  
  if (agentId === "cron") {
    const admins = await prisma.user.findMany();
    const adminUsers = admins.filter(u => u.role.toUpperCase() === 'ADMIN');
    const title = tierOneCount === 1 ? "New Tier 1 Lead Discovered (Cron)" : `New Tier 1 Leads Discovered (${tierOneCount}) (Cron)`;
    const body = `The scheduled scrape found ${tierOneCount} Tier 1 lead${tierOneCount === 1 ? "" : "s"}${runId ? ` for run ${runId}` : ""}.`;
    await Promise.all(adminUsers.map(admin => sendAgentNotification(admin.id, "newLead", title, body, { runId, tierOneCount })));
    return;
  }

  const title = tierOneCount === 1 ? "New Tier 1 Lead Discovered" : `New Tier 1 Leads Discovered (${tierOneCount})`;
  const body = `Your latest scrape found ${tierOneCount} Tier 1 lead${tierOneCount === 1 ? "" : "s"}${runId ? ` for run ${runId}` : ""}.`;
  await sendAgentNotification(agentId, "newLead", title, body, { runId, tierOneCount });
}

export async function notifyScrapeCompletion(agentId: string, totalLeads: number, runId: string) {
  if (agentId === "cron") {
    const admins = await prisma.user.findMany();
    const adminUsers = admins.filter(u => u.role.toUpperCase() === 'ADMIN');
    const title = "Scheduled Scrape Completed";
    const body = `Cron scrape run ${runId} finished with ${totalLeads} lead${totalLeads === 1 ? "" : "s"}.`;
    await Promise.all(adminUsers.map(admin => sendAgentNotification(admin.id, "scrapeComplete", title, body, { runId, totalLeads })));
    return;
  }

  const title = "Scrape Completed";
  const body = `Your scrape run ${runId} finished with ${totalLeads} lead${totalLeads === 1 ? "" : "s"}.`;
  await sendAgentNotification(agentId, "scrapeComplete", title, body, { runId, totalLeads });
}

export async function sendWeeklyDigestNotifications() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany();

  for (const user of users) {
    const prefs = getNotificationPreferences(user.preferences);
    if (!prefs.weeklyDigest) continue;

    const totalLeads = await prisma.lead.count({
      where: {
        agentId: user.id,
        createdAt: { gte: oneWeekAgo },
      },
    });

    const tierOneLeads = await prisma.lead.count({
      where: {
        agentId: user.id,
        tier: 1,
        createdAt: { gte: oneWeekAgo },
      },
    });

    const title = "Weekly Digest";
    const body = `This week you added ${totalLeads} new lead${totalLeads === 1 ? "" : "s"}, including ${tierOneLeads} Tier 1 lead${tierOneLeads === 1 ? "" : "s"}.`;

    await sendAgentNotification(user.id, "weeklyDigest", title, body, {
      totalLeads,
      tierOneLeads,
      periodStart: oneWeekAgo.toISOString(),
      periodEnd: new Date().toISOString(),
    });
  }
}
