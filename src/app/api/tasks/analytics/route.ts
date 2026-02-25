import { NextResponse } from "next/server";

import { buildTaskAnalytics } from "@/lib/tasks/analytics";
import { INITIAL_SCHEDULE_TASKS } from "@/lib/tasks/mock";

export async function GET() {
  const analytics = buildTaskAnalytics(INITIAL_SCHEDULE_TASKS);
  return NextResponse.json(analytics, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
