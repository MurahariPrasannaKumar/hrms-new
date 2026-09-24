import { http, unwrap } from "./client";

export interface UsageToday { date: string; seconds: number }

export const usageApi = {
  today: () => unwrap<UsageToday>(http.get("/usage/today")),
  heartbeat: (seconds: number) => unwrap<UsageToday>(http.post("/usage/heartbeat", { seconds })),
};
