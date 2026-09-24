import { cleanParams, http, unwrap, unwrapPage, type ListParams } from "./client";

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  CASUAL: "Casual leave", SICK: "Sick leave", EARNED: "Earned leave", UNPAID: "Unpaid leave", OTHER: "Other",
};

export interface LeaveRow {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: { name: string } };
  reviewer: { id: string; firstName: string; lastName: string } | null;
  school?: { id: string; name: string };
}

export interface LeaveBalance { type: LeaveType; allowance: number | null; used: number; pending: number; remaining: number | null }

export const leaveApi = {
  balances: () => unwrap<LeaveBalance[]>(http.get("/leave/balances")),
  mine: (p?: ListParams) => unwrapPage<LeaveRow>(http.get("/leave/mine", { params: cleanParams(p) })),
  apply: (body: { type: LeaveType; startDate: string; endDate: string; reason: string }) =>
    unwrap<LeaveRow & { adminsNotified: number }>(http.post("/leave", body)),
  cancel: (id: string) => unwrap<LeaveRow>(http.patch(`/leave/${id}/cancel`)),
  list: (p?: ListParams) => unwrapPage<LeaveRow>(http.get("/leave", { params: cleanParams(p) })),
  review: (id: string, body: { decision: "APPROVED" | "REJECTED" | "CANCELLED"; note?: string }) =>
    unwrap<LeaveRow>(http.patch(`/leave/${id}/review`, body)),
};
