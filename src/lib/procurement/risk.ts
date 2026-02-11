import type { ProcurementItem } from "./types";

const DAY_MS = 1000 * 60 * 60 * 24;

function isDeliveredOrComplete(item: ProcurementItem) {
  return item.status === "delivered" || item.status === "complete";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return startOfDay(date);
}

function daysUntil(target: Date, now: Date) {
  return Math.ceil((target.getTime() - now.getTime()) / DAY_MS);
}

export function isProcurementItemAtRisk(item: ProcurementItem, now = new Date()) {
  const needBy = parseDate(item.need_by_date);
  if (!needBy || isDeliveredOrComplete(item)) return false;

  const today = startOfDay(now);
  const expectedDelivery = parseDate(item.expected_delivery_date);

  if (expectedDelivery && expectedDelivery.getTime() > needBy.getTime()) return true;
  if (!expectedDelivery && daysUntil(needBy, today) <= 7 && daysUntil(needBy, today) >= 0) return true;
  if (today.getTime() > needBy.getTime()) return true;

  return false;
}
