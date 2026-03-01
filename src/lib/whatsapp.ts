import Twilio from "twilio";
import { formatDate } from "@/lib/utils";

// Lazy-initialized Twilio client to avoid build-time errors when credentials are missing
const globalForTwilio = globalThis as unknown as {
  twilioClient: ReturnType<typeof Twilio> | undefined;
};

export function getTwilioClient() {
  if (!globalForTwilio.twilioClient) {
    globalForTwilio.twilioClient = Twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return globalForTwilio.twilioClient;
}

export const TWILIO_WHATSAPP_FROM =
  process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

interface WhatsAppPassParams {
  eventTitle: string;
  eventDate: string | Date;
  name: string;
  block: number;
  flatNumber: string;
  passUrl: string;
}

export function composePassWhatsAppMessage(
  params: WhatsAppPassParams
): string {
  const { eventTitle, eventDate, name, block, flatNumber, passUrl } = params;
  const dateStr =
    eventDate instanceof Date ? eventDate.toISOString() : eventDate;
  const formattedDate = formatDate(dateStr);

  return [
    `\u{1F3AB} *RMV Clusters Phase II \u2014 Event Pass*`,
    ``,
    `*Event:* ${eventTitle}`,
    `*Date:* ${formattedDate}`,
    `*Name:* ${name}`,
    `*Location:* Block ${block} \u2014 Flat ${flatNumber}`,
    ``,
    `View your pass here:`,
    passUrl,
    ``,
    `Show this pass at the event entrance for verification.`,
  ].join("\n");
}

/**
 * Normalize an Indian phone number to E.164 format.
 * Strips spaces, dashes, and parentheses.
 * If no country code prefix, prepends +91.
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }
    cleaned = "+91" + cleaned;
  }
  return cleaned;
}

/**
 * Send event pass via WhatsApp. Returns { success, error? }.
 * Never throws — safe for fire-and-forget usage.
 */
export async function sendPassWhatsApp(
  phone: string,
  messageParams: WhatsAppPassParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    const body = composePassWhatsAppMessage(messageParams);

    await getTwilioClient().messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to: `whatsapp:${normalizedPhone}`,
      body,
    });

    return { success: true };
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return {
      success: false,
      error: "Failed to send WhatsApp message",
    };
  }
}
