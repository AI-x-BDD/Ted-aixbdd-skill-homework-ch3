import { now } from "../clock.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import { toIso } from "./authService.js";

const META = {
  max_duration_minutes: {
    name: "單次時長上限",
    unit: "hours",
    display: (v) => v / 60,
    store: (v) => v * 60,
  },
  max_advance_days: { name: "最遠可預約天數", unit: "days" },
  max_active_bookings: { name: "每人有效預約上限", unit: "count" },
  max_active_series: { name: "每人週期性預約批數上限", unit: "batches" },
  max_series_months: { name: "週期性預約最長月數", unit: "months" },
  late_cancel_minutes: {
    name: "逾時取消門檻",
    unit: "hours",
    display: (v) => v / 60,
    store: (v) => v * 60,
  },
  waitlist_confirm_minutes: { name: "候補確認時限", unit: "minutes" },
  waitlist_cutoff_minutes: {
    name: "候補截止門檻",
    unit: "hours",
    display: (v) => v / 60,
    store: (v) => v * 60,
  },
  checkin_open_minutes: { name: "報到開放時間", unit: "minutes" },
  checkin_close_minutes: { name: "報到截止時間", unit: "minutes" },
  no_show_window_days: { name: "未到場統計天數", unit: "days" },
  no_show_threshold: { name: "未到場次數門檻", unit: "times" },
  suspend_days: { name: "暫停天數", unit: "days" },
  reminder_minutes: { name: "開始前提醒時間", unit: "minutes" },
};

function requireAdmin(user) {
  if (!can(user, "rule:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

function toDisplay(key, stored) {
  const meta = META[key];
  return meta.display ? meta.display(stored) : stored;
}

export async function listRules(user) {
  requireAdmin(user);
  return withTransaction(async (conn) => {
    const snapshot = await ruleRepository.loadAll(conn);
    return {
      items: Object.keys(META).map((key) => {
        const meta = META[key];
        const stored = snapshot[key]?.int_value;
        return {
          key,
          name: meta.name,
          value: toDisplay(key, stored),
          unit: meta.unit,
        };
      }),
    };
  });
}

export async function updateRule(admin, ruleKey, value) {
  requireAdmin(admin);
  if (!META[ruleKey]) {
    throw new HttpError(404, "找不到這個規則。");
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new HttpError(400, "規則值須為正整數。", {
      fields: [{ field: "value", message: "規則值須為正整數。" }],
    });
  }
  const stored = META[ruleKey].store ? META[ruleKey].store(value) : value;
  if (ruleKey === "max_duration_minutes" && stored % 30 !== 0) {
    throw new HttpError(400, "單次時長上限須為 30 分鐘的倍數。");
  }
  const current = now();
  return withTransaction(async (conn) => {
    const snapshot = await ruleRepository.loadAll(conn);
    const oldValue = snapshot[ruleKey].int_value;
    await ruleRepository.update(conn, ruleKey, stored, {
      actorUserId: admin.id,
      now: current,
    });
    await ruleRepository.insertChange(conn, {
      rule_key: ruleKey,
      actor_user_id: admin.id,
      changed_at: current,
      old_value: oldValue,
      new_value: stored,
    });
    return {
      key: ruleKey,
      name: META[ruleKey].name,
      value,
      unit: META[ruleKey].unit,
    };
  });
}

export async function listRuleChanges(user, query = {}) {
  requireAdmin(user);
  return withTransaction(async (conn) => {
    const { items, total } = await ruleRepository.listChanges(conn, {
      limit: Number(query.limit ?? 20),
      beforeId: query.beforeId ? Number(query.beforeId) : undefined,
    });
    return {
      items: items.map((row) => ({
        id: Number(row.id),
        ruleKey: row.rule_key,
        ruleName: META[row.rule_key]?.name ?? row.rule_key,
        unit: META[row.rule_key]?.unit ?? "minutes",
        actorName: row.actor_name,
        changedAt: toIso(row.changed_at),
        oldValue: toDisplay(row.rule_key, row.old_value),
        newValue: toDisplay(row.rule_key, row.new_value),
      })),
      total,
    };
  });
}
