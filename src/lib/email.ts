import { Resend } from "resend";
import { formatDate } from "@/lib/utils";

// Lazy-initialized Resend client to avoid build-time errors when API key is missing
const globalForResend = globalThis as unknown as {
  resend: Resend | undefined;
};

export function getResend(): Resend {
  if (!globalForResend.resend) {
    globalForResend.resend = new Resend(process.env.RESEND_API_KEY);
  }
  return globalForResend.resend;
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  "RMV Clusters Phase II <onboarding@resend.dev>";

interface PassEmailParams {
  eventTitle: string;
  eventDate: string | Date;
  name: string;
  type: "resident" | "guest";
  block: number;
  flatNumber: string;
  hasFood: boolean;
  items: { name: string; plates: number; pricePerPlate: number }[];
  paid: boolean;
  qrCodeDataUrl: string;
  passUrl: string;
}

export function renderPassEmailHtml(params: PassEmailParams): string {
  const {
    eventTitle,
    eventDate,
    name,
    type,
    block,
    flatNumber,
    hasFood,
    items,
    paid,
    qrCodeDataUrl,
    passUrl,
  } = params;

  const dateStr =
    eventDate instanceof Date ? eventDate.toISOString() : eventDate;
  const formattedDate = formatDate(dateStr);
  const typeBadge =
    type === "guest"
      ? '<span style="display:inline-block;padding:2px 10px;font-size:12px;font-weight:600;border-radius:12px;background-color:#f3e8ff;color:#7e22ce;">Guest</span>'
      : '<span style="display:inline-block;padding:2px 10px;font-size:12px;font-weight:600;border-radius:12px;background-color:#dbeafe;color:#1d4ed8;">Resident</span>';

  const totalAmount = items.reduce(
    (sum, item) => sum + item.plates * item.pricePerPlate,
    0
  );
  const totalPlates = items.reduce((sum, item) => sum + item.plates, 0);

  let foodSection = "";
  if (hasFood && items.length > 0) {
    const itemRows = items
      .map(
        (item) => `
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#374151;">${item.name} &times; ${item.plates}</td>
          <td style="padding:4px 0;font-size:14px;color:#6b7280;text-align:right;">&#8377;${(item.plates * item.pricePerPlate).toFixed(2)}</td>
        </tr>`
      )
      .join("");

    foodSection = `
      <tr>
        <td style="padding:16px 24px;border-top:1px dashed #e5e7eb;">
          <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">Items Ordered</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${itemRows}
            <tr>
              <td colspan="2" style="padding:8px 0 0;border-top:1px solid #f3f4f6;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:14px;font-weight:600;color:#1f2937;">Total (${totalPlates} plate${totalPlates !== 1 ? "s" : ""})</td>
                    <td style="font-size:14px;font-weight:600;color:#111827;text-align:right;">&#8377;${totalAmount.toFixed(2)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
  }

  let paymentSection = "";
  if (hasFood) {
    const paymentBg = paid ? "#f0fdf4" : "#fffbeb";
    const paymentBorder = paid ? "#bbf7d0" : "#fde68a";
    const paymentColor = paid ? "#15803d" : "#b45309";
    const paymentText = paid ? "Payment Received" : "Payment Pending";

    paymentSection = `
      <tr>
        <td style="padding:0 24px 20px;">
          <div style="border-radius:8px;padding:10px;text-align:center;font-size:14px;font-weight:500;background-color:${paymentBg};color:${paymentColor};border:1px solid ${paymentBorder};">
            ${paymentText}
          </div>
        </td>
      </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Pass - ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1d4ed8;padding:16px 24px;color:#ffffff;">
              <p style="margin:0;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;opacity:0.8;">RMV Clusters Phase II</p>
              <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;">Event Pass</h1>
            </td>
          </tr>

          <!-- Event Info -->
          <tr>
            <td style="padding:20px 24px 16px;border-bottom:1px dashed #e5e7eb;">
              <h2 style="margin:0;font-size:18px;font-weight:700;color:#111827;">${eventTitle}</h2>
              <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${formattedDate}</p>
            </td>
          </tr>

          <!-- Person Info -->
          <tr>
            <td style="padding:16px 24px;border-bottom:1px dashed #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">Name</p>
                    <p style="margin:2px 0 0;font-size:16px;font-weight:600;color:#111827;">${name}</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    ${typeBadge}
                  </td>
                </tr>
              </table>
              <div style="margin-top:12px;">
                <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">Location</p>
                <p style="margin:2px 0 0;font-size:14px;font-weight:500;color:#1f2937;">Block ${block} &mdash; Flat ${flatNumber}</p>
              </div>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td style="padding:20px 24px;text-align:center;">
              <div style="display:inline-block;padding:12px;border:2px solid #f3f4f6;border-radius:12px;">
                <img src="${qrCodeDataUrl}" width="200" height="200" alt="QR Code" style="display:block;" />
              </div>
              <p style="margin:12px 0 0;font-size:12px;color:#6b7280;">
                <a href="${passUrl}" style="color:#2563eb;text-decoration:underline;">View Pass Online</a>
              </p>
            </td>
          </tr>

          ${foodSection}
          ${paymentSection}

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:12px 24px;text-align:center;">
              <p style="margin:0;font-size:10px;color:#9ca3af;">Show this pass at the event entrance for verification</p>
            </td>
          </tr>
        </table>

        <!-- Below card note -->
        <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
          This email was sent from RMV Clusters Phase II community portal.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
