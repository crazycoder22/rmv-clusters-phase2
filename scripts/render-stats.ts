import { generateStepChartPng } from "../src/lib/step-chart";
import { renderStepStatsEmailHtml } from "../src/lib/email";
import * as fs from "fs";

const dailySteps = [
  { date: "2026-03-14", steps: 10611 },
  { date: "2026-03-15", steps: 16116 },
  { date: "2026-03-16", steps: 10966 },
  { date: "2026-03-17", steps: 16475 },
  { date: "2026-03-18", steps: 11165 },
  { date: "2026-03-19", steps: 14080 },
  { date: "2026-03-20", steps: 10293 },
  { date: "2026-03-21", steps: 11018 },
  { date: "2026-03-22", steps: 10173 },
  { date: "2026-03-23", steps: 15877 },
  { date: "2026-03-24", steps: 10544 },
  { date: "2026-03-25", steps: 10156 },
  { date: "2026-03-26", steps: 10522 },
  { date: "2026-03-27", steps: 11019 },
];

async function main() {
  const chartPng = await generateStepChartPng(dailySteps, 10000);
  fs.writeFileSync("/tmp/lakshman-stepchart.png", chartPng);

  let html = renderStepStatsEmailHtml({
    eventTitle: "Mini StepUp 2026-1",
    name: "Lakshman",
    block: 3,
    flatNumber: "002/003",
    rank: 10,
    totalParticipants: 30,
    totalSteps: 169015,
    averageDailySteps: 12072,
    dailyGoal: 10000,
    daysTracked: 14,
    daysGoalMet: 14,
    challengeDays: 14,
    bestDay: { date: "2026-03-17", steps: 16475 },
  });

  const chartB64 = chartPng.toString("base64");
  html = html.replace("cid:stepchart", "data:image/png;base64," + chartB64);

  fs.writeFileSync("/tmp/lakshman-stats.html", html);
  console.log("Done! Files saved to /tmp/lakshman-stats.html and /tmp/lakshman-stepchart.png");
}

main();
