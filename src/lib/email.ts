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
                <img src="cid:qrcode" width="200" height="200" alt="QR Code" style="display:block;" />
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

// --- Step Stats Email ---

interface StepStatsEmailParams {
  eventTitle: string;
  name: string;
  block: number;
  flatNumber: string;
  rank: number;
  totalParticipants: number;
  totalSteps: number;
  averageDailySteps: number;
  dailyGoal: number;
  daysTracked: number;
  daysGoalMet: number;
  bestDay: { date: string; steps: number } | null;
}

function formatSteps(n: number): string {
  return n.toLocaleString("en-IN");
}

function getRankBadge(rank: number): string {
  if (rank === 1)
    return '<span style="font-size:28px;line-height:1;">&#129351;</span>';
  if (rank === 2)
    return '<span style="font-size:28px;line-height:1;">&#129352;</span>';
  if (rank === 3)
    return '<span style="font-size:28px;line-height:1;">&#129353;</span>';
  return `<span style="display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;border-radius:50%;background-color:#f3f4f6;color:#374151;font-size:14px;font-weight:700;">#${rank}</span>`;
}

export function renderStepStatsEmailHtml(params: StepStatsEmailParams): string {
  const {
    eventTitle,
    name,
    block,
    flatNumber,
    rank,
    totalParticipants,
    totalSteps,
    averageDailySteps,
    dailyGoal,
    daysTracked,
    daysGoalMet,
    bestDay,
  } = params;

  const bestDayStr = bestDay
    ? `${formatSteps(bestDay.steps)} <span style="font-size:11px;color:#9ca3af;">(${new Date(bestDay.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})</span>`
    : "&mdash;";

  const goalMetPct =
    daysTracked > 0 ? Math.round((daysGoalMet / daysTracked) * 100) : 0;

  function statCell(label: string, value: string, color: string): string {
    return `<td style="width:50%;padding:8px;">
      <div style="background-color:${color};border-radius:10px;padding:12px 14px;">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${label}</p>
        <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#111827;">${value}</p>
      </div>
    </td>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Step Stats - ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8,#7c3aed);padding:20px 24px;color:#ffffff;">
              <p style="margin:0;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;opacity:0.8;">RMV Clusters Phase II</p>
              <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;">Step Challenge Stats</h1>
              <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${eventTitle}</p>
            </td>
          </tr>

          <!-- Person + Rank -->
          <tr>
            <td style="padding:20px 24px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#9ca3af;">Participant</p>
                    <p style="margin:2px 0 0;font-size:18px;font-weight:700;color:#111827;">${name}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">Block ${block} &mdash; Flat ${flatNumber}</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <div style="text-align:center;">
                      ${getRankBadge(rank)}
                      <p style="margin:2px 0 0;font-size:10px;color:#9ca3af;">of ${totalParticipants}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats Grid -->
          <tr>
            <td style="padding:0 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  ${statCell("Total Steps", formatSteps(totalSteps), "#eff6ff")}
                  ${statCell("Avg / Day", formatSteps(averageDailySteps), "#f0fdf4")}
                </tr>
                <tr>
                  ${statCell("Daily Goal", dailyGoal > 0 ? formatSteps(dailyGoal) : "&mdash;", "#fefce8")}
                  ${statCell("Days Tracked", String(daysTracked), "#faf5ff")}
                </tr>
                <tr>
                  ${statCell("Days Goal Met", dailyGoal > 0 ? `${daysGoalMet} / ${daysTracked} <span style="font-size:11px;color:#6b7280;">(${goalMetPct}%)</span>` : "&mdash;", "#f0fdf4")}
                  ${statCell("Best Day", bestDayStr, "#fff7ed")}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Chart -->
          <tr>
            <td style="padding:20px 24px 8px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;">Daily Progress</p>
              <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
                <img src="cid:stepchart" width="560" style="display:block;width:100%;height:auto;" alt="Daily Steps Chart" />
              </div>
            </td>
          </tr>

          <!-- Legend -->
          <tr>
            <td style="padding:4px 24px 20px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background-color:#22c55e;vertical-align:middle;"></span>
                    <span style="font-size:11px;color:#6b7280;vertical-align:middle;margin-left:4px;">Met Goal</span>
                  </td>
                  <td style="padding-right:12px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background-color:#60a5fa;vertical-align:middle;"></span>
                    <span style="font-size:11px;color:#6b7280;vertical-align:middle;margin-left:4px;">Below Goal</span>
                  </td>
                  ${dailyGoal > 0 ? `<td>
                    <span style="display:inline-block;width:10px;height:2px;background-color:#ef4444;vertical-align:middle;border-top:1px dashed #ef4444;"></span>
                    <span style="font-size:11px;color:#6b7280;vertical-align:middle;margin-left:4px;">Goal Line</span>
                  </td>` : ""}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Keep stepping! Every step counts towards your goal.</p>
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
