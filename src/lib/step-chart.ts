import sharp from "sharp";

interface DayEntry {
  date: string;
  steps: number;
}

export async function generateStepChartPng(
  dailySteps: DayEntry[],
  dailyGoal: number
): Promise<Buffer> {
  if (dailySteps.length === 0) {
    // Return a minimal 1x1 transparent PNG if no data
    return sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } },
    })
      .png()
      .toBuffer();
  }

  const width = 560;
  const height = 200;
  const paddingLeft = 50;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxSteps = Math.max(...dailySteps.map((d) => d.steps), dailyGoal || 1, 100);
  const barCount = dailySteps.length;
  const gap = Math.max(2, Math.min(6, Math.floor(chartWidth / barCount / 6)));
  const barWidth = Math.max(4, Math.floor((chartWidth - gap * (barCount + 1)) / barCount));
  const totalBarsWidth = barCount * barWidth + (barCount + 1) * gap;
  const offsetX = paddingLeft + Math.floor((chartWidth - totalBarsWidth) / 2);

  // Y-axis labels
  const yMid = Math.round(maxSteps / 2);
  const yMidY = paddingTop + chartHeight / 2;

  // Build bars
  let barsStr = "";
  let labelsStr = "";
  const showEveryN = barCount > 15 ? Math.ceil(barCount / 12) : barCount > 8 ? 2 : 1;

  for (let i = 0; i < barCount; i++) {
    const d = dailySteps[i];
    const barH = Math.max(2, (d.steps / maxSteps) * chartHeight);
    const x = offsetX + gap + i * (barWidth + gap);
    const y = paddingTop + chartHeight - barH;
    const metGoal = dailyGoal > 0 && d.steps >= dailyGoal;
    const fill = metGoal ? "#22c55e" : "#60a5fa";

    barsStr += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${fill}" rx="2"/>`;

    // X-axis labels
    if (i % showEveryN === 0 || i === barCount - 1) {
      const dt = new Date(d.date);
      const label = `${dt.getDate()} ${dt.toLocaleString("en-IN", { month: "short" })}`;
      labelsStr += `<text x="${x + barWidth / 2}" y="${paddingTop + chartHeight + 16}" text-anchor="middle" font-size="9" font-family="Arial,sans-serif" fill="#6b7280">${label}</text>`;
    }
  }

  // Goal line
  let goalLine = "";
  if (dailyGoal > 0) {
    const goalY = paddingTop + chartHeight - (dailyGoal / maxSteps) * chartHeight;
    goalLine = `
      <line x1="${paddingLeft}" y1="${goalY}" x2="${width - paddingRight}" y2="${goalY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.7"/>
      <text x="${paddingLeft - 4}" y="${goalY + 3}" text-anchor="end" font-size="8" font-family="Arial,sans-serif" fill="#ef4444" font-weight="600">${dailyGoal >= 1000 ? Math.round(dailyGoal / 1000) + "k" : dailyGoal}</text>
    `;
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#ffffff" rx="8"/>

  <!-- Grid lines -->
  <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartHeight}" stroke="#e5e7eb" stroke-width="1"/>
  <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="#e5e7eb" stroke-width="1"/>
  <line x1="${paddingLeft}" y1="${yMidY}" x2="${width - paddingRight}" y2="${yMidY}" stroke="#f3f4f6" stroke-width="0.5" stroke-dasharray="3,3"/>

  <!-- Y-axis labels -->
  <text x="${paddingLeft - 6}" y="${paddingTop + 4}" text-anchor="end" font-size="9" font-family="Arial,sans-serif" fill="#9ca3af">${maxSteps >= 1000 ? Math.round(maxSteps / 1000) + "k" : maxSteps}</text>
  <text x="${paddingLeft - 6}" y="${yMidY + 3}" text-anchor="end" font-size="9" font-family="Arial,sans-serif" fill="#9ca3af">${yMid >= 1000 ? Math.round(yMid / 1000) + "k" : yMid}</text>
  <text x="${paddingLeft - 6}" y="${paddingTop + chartHeight + 3}" text-anchor="end" font-size="9" font-family="Arial,sans-serif" fill="#9ca3af">0</text>

  <!-- Bars -->
  ${barsStr}

  <!-- Goal line -->
  ${goalLine}

  <!-- X-axis labels -->
  ${labelsStr}
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
