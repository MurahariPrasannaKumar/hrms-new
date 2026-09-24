export const formatDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
export const formatDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—");
export const personName = (u?: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}` : "—");
export const humanize = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
