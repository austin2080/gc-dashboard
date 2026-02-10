import { ProcurementItem } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function isAtRisk(item: ProcurementItem, today = new Date()): boolean {
  const needBy = parseDate(item.need_by_date);
  if (!needBy) return false;

  if (item.status === "delivered" || item.status === "complete") {
    return false;
  }

  const expected = parseDate(item.expected_delivery_date);
  if (expected && expected.getTime() > needBy.getTime()) {
    return true;
  }

  if (!expected) {
    const daysUntilNeedBy = Math.floor((needBy.getTime() - today.getTime()) / DAY_MS);
    if (daysUntilNeedBy <= 7 && daysUntilNeedBy >= 0) {
      return true;
    }
  }

  if (today.getTime() > needBy.getTime()) {
    return true;
  }

  return false;
}
