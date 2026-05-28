import type { DailyJob } from "./types";
import { habitReminders } from "./habit-reminders";
import { eventReminders } from "./event-reminders";

// Every daily job the dispatcher should run. To add a future scheduled task
// (RSVP deadline reminders, step-sync nudges, weekly digest, ...), write a
// new module exporting a DailyJob and add it here — nothing else changes.
export const DAILY_JOBS: DailyJob[] = [habitReminders, eventReminders];
