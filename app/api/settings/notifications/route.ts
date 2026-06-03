import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, normalizePreferences, parsePreferences } from "@/lib/auth";
import { defaultNotificationPrefs, type NotificationPreferences } from "@/lib/notifications";

// ── Validation helpers ──────────────────────────────────────────────
const ALLOWED_BOOLEAN_KEYS: (keyof NotificationPreferences)[] = [
  "emailAlerts",
  "pushNotifications",
  "newLeadAlerts",
  "scrapeCompletion",
  "weeklyDigest",
  "whatsappAlerts",
];

/**
 * Sanitise incoming preferences payload.
 * - Boolean keys must be actual booleans.
 * - whatsappPhoneNumber must be a string, max 20 chars, digits/+/- only.
 * - Any unknown key is silently stripped.
 */
function sanitizePreferences(raw: unknown): NotificationPreferences {
  if (raw === null || typeof raw !== "object") {
    throw new Error("Invalid preferences payload");
  }

  const input = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of ALLOWED_BOOLEAN_KEYS) {
    if (key in input) {
      if (typeof input[key] !== "boolean") {
        throw new Error(`Field "${key}" must be a boolean`);
      }
      result[key] = input[key];
    }
  }

  if ("whatsappPhoneNumber" in input) {
    const phone = input.whatsappPhoneNumber;
    if (typeof phone !== "string" || phone.length > 20) {
      throw new Error("whatsappPhoneNumber must be a string (max 20 chars)");
    }
    // Allow only digits, plus, dash, and spaces — strip anything else
    const cleaned = phone.replace(/[^\d+\-\s]/g, "").trim();
    result.whatsappPhoneNumber = cleaned;
  }

  return result as unknown as NotificationPreferences;
}

// ── GET: fetch current notification preferences ─────────────────────
export async function GET(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const parsed = parsePreferences((user as any)?.preferences);

    // Determine the notifications sub-object.
    // Fix: explicit grouping to avoid JS operator precedence bugs
    // (previously `??` and `!==` / `?:` interacted incorrectly).
    const hasNotificationsKey = parsed?.notifications != null;
    const hasLegacyShape = parsed?.emailAlerts !== undefined;
    const raw = hasNotificationsKey
      ? parsed.notifications
      : hasLegacyShape
        ? parsed
        : {};

    // Merge with defaults so every key is always present
    const preferences: NotificationPreferences = {
      ...defaultNotificationPrefs,
      ...raw,
    };

    return NextResponse.json({ preferences }, { status: 200 });
  } catch (error: any) {
    console.error("Fetch preferences error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: error?.message },
      { status: 500 },
    );
  }
}

// ── POST: save notification preferences ─────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate & sanitize — rejects bad types with 400 instead of silently
    // persisting garbage into the database.
    let sanitized: NotificationPreferences;
    try {
      sanitized = sanitizePreferences(body?.preferences);
    } catch (validationErr: any) {
      return NextResponse.json(
        { error: validationErr.message },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const existingPrefs = parsePreferences((user as any)?.preferences);
    const updatedPreferences = {
      ...existingPrefs,
      notifications: {
        ...(existingPrefs.notifications ?? existingPrefs),
        ...sanitized,
      },
    };

    await prisma.user.update({
      where: { id: session.id },
      data: { preferences: normalizePreferences(updatedPreferences) },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
