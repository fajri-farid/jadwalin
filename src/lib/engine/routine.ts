import {
  buildValidSlotKeySet,
  filterAvailabilitiesToEvent,
  isoDateToDayOfWeek,
  normalizeColumns,
  parseSlotKey,
} from "@/lib/engine/slots";
import type { AvailabilityMap, DayOfWeek, SlotScheduleConfig } from "@/types/schedule";

export interface ApplyRoutineOptions {
  existingAvailabilities?: AvailabilityMap;
  mode?: "merge" | "replace";
}

export interface ApplyRoutineResult {
  availabilities: AvailabilityMap;
  appliedCount: number;
  skippedCount: number;
}

/**
 * Menerapkan template mingguan `weeklyRoutine` ("DAY-HH:mm") ke room target baik berformat
 * `days_of_week` maupun `specific_dates` secara UTC-safe.
 */
export function applyWeeklyRoutineToEvent(
  weeklyRoutine: AvailabilityMap,
  config: SlotScheduleConfig,
  options?: ApplyRoutineOptions
): ApplyRoutineResult {
  const mode = options?.mode ?? "merge";
  const nextAvailabilities: AvailabilityMap =
    mode === "merge" && options?.existingAvailabilities
      ? filterAvailabilitiesToEvent(options.existingAvailabilities, config)
      : {};

  const validSlotKeySet = buildValidSlotKeySet(config);
  const columnsByDay = new Map<DayOfWeek, string[]>();

  if (config.dateMode === "specific_dates") {
    for (const dateStr of normalizeColumns("specific_dates", config.dates)) {
      const dow = isoDateToDayOfWeek(dateStr);
      if (!dow) continue;
      const list = columnsByDay.get(dow) ?? [];
      list.push(dateStr);
      columnsByDay.set(dow, list);
    }
  }

  let appliedCount = 0;
  let skippedCount = 0;

  for (const [routineKey, status] of Object.entries(weeklyRoutine)) {
    if (status !== "free" && status !== "tentative") {
      skippedCount += 1;
      continue;
    }

    const parsed = parseSlotKey(routineKey);
    if (!parsed || parsed.dateMode !== "days_of_week") {
      skippedCount += 1;
      continue;
    }

    if (config.dateMode === "days_of_week") {
      if (validSlotKeySet.has(routineKey)) {
        nextAvailabilities[routineKey] = status;
        appliedCount += 1;
      } else {
        skippedCount += 1;
      }
      continue;
    }

    const matchingDates = columnsByDay.get(parsed.columnKey as DayOfWeek) ?? [];
    let matchedForEntry = false;
    for (const dateStr of matchingDates) {
      const targetKey = `${dateStr}T${parsed.time}`;
      if (validSlotKeySet.has(targetKey)) {
        nextAvailabilities[targetKey] = status;
        appliedCount += 1;
        matchedForEntry = true;
      }
    }

    if (!matchedForEntry) {
      skippedCount += 1;
    }
  }

  return {
    availabilities: nextAvailabilities,
    appliedCount,
    skippedCount,
  };
}

/** Mengekstrak isian jadwal room menjadi template mingguan ("DAY-HH:mm") untuk akun Google. */
export function extractWeeklyRoutineFromAvailabilities(
  availabilities: AvailabilityMap,
  config: SlotScheduleConfig,
  baseRoutine?: AvailabilityMap
): AvailabilityMap {
  const routine: AvailabilityMap = {};

  if (baseRoutine) {
    for (const [key, status] of Object.entries(baseRoutine)) {
      const parsed = parseSlotKey(key);
      if (
        parsed &&
        parsed.dateMode === "days_of_week" &&
        (status === "free" || status === "tentative")
      ) {
        routine[key] = status;
      }
    }
  }

  const validEventAvailabilities = filterAvailabilitiesToEvent(availabilities, config);
  for (const [slotKey, status] of Object.entries(validEventAvailabilities)) {
    const parsed = parseSlotKey(slotKey);
    if (!parsed) continue;

    if (parsed.dateMode === "days_of_week") {
      routine[slotKey] = status;
      continue;
    }

    const dow = isoDateToDayOfWeek(parsed.columnKey);
    if (dow) {
      routine[`${dow}-${parsed.time}`] = status;
    }
  }

  return routine;
}
