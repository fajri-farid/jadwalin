import type { AvailabilityMap, DateMode, DayOfWeek, SlotScheduleConfig } from "@/types/schedule";

export const SLOT_INTERVAL_MIN = 30;

export const DAYS_OF_WEEK_ORDER: readonly DayOfWeek[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;

const JS_UTC_DAY_TO_DOW: readonly DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
] as const;

export const DAY_LABEL_SHORT: Record<DayOfWeek, string> = {
  MON: "Sen",
  TUE: "Sel",
  WED: "Rab",
  THU: "Kam",
  FRI: "Jum",
  SAT: "Sab",
  SUN: "Min",
};

export const DAY_LABEL_LONG: Record<DayOfWeek, string> = {
  MON: "Senin",
  TUE: "Selasa",
  WED: "Rabu",
  THU: "Kamis",
  FRI: "Jumat",
  SAT: "Sabtu",
  SUN: "Minggu",
};

const MONTH_LABEL_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agt",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const MONTH_LABEL_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_REGEX = /^(\d{2}):(\d{2})$/;
const SPECIFIC_SLOT_KEY_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;
const WEEKLY_SLOT_KEY_REGEX = /^(MON|TUE|WED|THU|FRI|SAT|SUN)-(\d{2}:\d{2})$/;

export interface ParsedSlotKey {
  dateMode: DateMode;
  columnKey: string;
  time: string;
}

/** Memeriksa apakah string tanggal berformat YYYY-MM-DD merupakan tanggal kalender valid. */
export function isValidIsoDate(dateStr: string): boolean {
  const match = ISO_DATE_REGEX.exec(dateStr);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

export function isDayOfWeek(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK_ORDER as readonly string[]).includes(value);
}

/** Mengonversi tanggal YYYY-MM-DD ke DayOfWeek secara UTC-safe agar tidak bergeser oleh zona waktu. */
export function isoDateToDayOfWeek(dateStr: string): DayOfWeek | null {
  if (!isValidIsoDate(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return JS_UTC_DAY_TO_DOW[utcDay] ?? null;
}

export function parseTimeToMinutes(time: string): number | null {
  const match = TIME_REGEX.exec(time);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours === 24 && minutes === 0) return 1440;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes > 1440) {
    throw new RangeError(`Total menit di luar rentang 0..1440: ${totalMinutes}`);
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, deltaMinutes: number): string {
  const baseMinutes = parseTimeToMinutes(time);
  if (baseMinutes === null) {
    throw new RangeError(`Format waktu tidak valid: ${time}`);
  }
  return formatMinutesToTime(baseMinutes + deltaMinutes);
}

/** Membangun daftar slot jam naik (mis. ["08:00", "08:30", ...]) dalam rentang jam room. */
export function buildTimeSlots(
  startHour: number,
  endHour: number,
  intervalMin = SLOT_INTERVAL_MIN
): string[] {
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new RangeError(`startHour harus bilangan bulat 0..23, diterima: ${startHour}`);
  }
  if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24 || endHour <= startHour) {
    throw new RangeError(
      `endHour harus bilangan bulat > startHour dan <= 24, diterima: ${endHour}`
    );
  }
  if (!Number.isInteger(intervalMin) || intervalMin <= 0 || 60 % intervalMin !== 0) {
    throw new RangeError(
      `intervalMin harus faktor pembagi 60 yang positif, diterima: ${intervalMin}`
    );
  }

  const slots: string[] = [];
  const startTotal = startHour * 60;
  const endTotal = endHour * 60;
  for (let mins = startTotal; mins < endTotal; mins += intervalMin) {
    slots.push(formatMinutesToTime(mins));
  }
  return slots;
}

export function normalizeColumns(dateMode: DateMode, dates: readonly string[]): string[] {
  const unique = new Set<string>();

  if (dateMode === "specific_dates") {
    for (const dateStr of dates) {
      if (isValidIsoDate(dateStr)) {
        unique.add(dateStr);
      }
    }
    return [...unique].sort((a, b) => a.localeCompare(b));
  }

  for (const dayStr of dates) {
    if (isDayOfWeek(dayStr)) {
      unique.add(dayStr);
    }
  }
  return DAYS_OF_WEEK_ORDER.filter((day) => unique.has(day));
}

export function createSlotKey(dateMode: DateMode, columnKey: string, time: string): string {
  const minutes = parseTimeToMinutes(time);
  if (minutes === null || minutes >= 1440) {
    throw new RangeError(`Waktu slot tidak valid untuk key: ${time}`);
  }

  if (dateMode === "specific_dates") {
    if (!isValidIsoDate(columnKey)) {
      throw new RangeError(`Tanggal kolom tidak valid: ${columnKey}`);
    }
    return `${columnKey}T${time}`;
  }

  if (!isDayOfWeek(columnKey)) {
    throw new RangeError(`Kode hari kolom tidak valid: ${columnKey}`);
  }
  return `${columnKey}-${time}`;
}

export function parseSlotKey(slotKey: string): ParsedSlotKey | null {
  const specificMatch = SPECIFIC_SLOT_KEY_REGEX.exec(slotKey);
  if (specificMatch) {
    const [, dateStr, timeStr] = specificMatch;
    const mins = parseTimeToMinutes(timeStr);
    if (isValidIsoDate(dateStr) && mins !== null && mins < 1440) {
      return {
        dateMode: "specific_dates",
        columnKey: dateStr,
        time: timeStr,
      };
    }
    return null;
  }

  const weeklyMatch = WEEKLY_SLOT_KEY_REGEX.exec(slotKey);
  if (weeklyMatch) {
    const [, dayStr, timeStr] = weeklyMatch;
    const mins = parseTimeToMinutes(timeStr);
    if (isDayOfWeek(dayStr) && mins !== null && mins < 1440) {
      return {
        dateMode: "days_of_week",
        columnKey: dayStr,
        time: timeStr,
      };
    }
    return null;
  }

  return null;
}

/** Membangun daftar seluruh slotKey sah milik room sesuai kolom dan rentang jam aktif. */
export function buildValidSlotKeys(config: SlotScheduleConfig): string[] {
  const columns = normalizeColumns(config.dateMode, config.dates);
  const timeSlots = buildTimeSlots(
    config.startHour,
    config.endHour,
    config.slotIntervalMin ?? SLOT_INTERVAL_MIN
  );
  const result: string[] = [];

  for (const columnKey of columns) {
    for (const time of timeSlots) {
      result.push(createSlotKey(config.dateMode, columnKey, time));
    }
  }
  return result;
}

export function buildValidSlotKeySet(config: SlotScheduleConfig): Set<string> {
  return new Set(buildValidSlotKeys(config));
}

export function filterAvailabilitiesToEvent(
  availabilities: AvailabilityMap,
  config: SlotScheduleConfig
): AvailabilityMap {
  const validKeys = buildValidSlotKeySet(config);
  const filtered: AvailabilityMap = {};

  for (const [slotKey, status] of Object.entries(availabilities)) {
    if (validKeys.has(slotKey) && (status === "free" || status === "tentative")) {
      filtered[slotKey] = status;
    }
  }
  return filtered;
}

export function formatColumnLabel(
  dateMode: DateMode,
  columnKey: string,
  style: "short" | "long" = "short"
): string {
  if (dateMode === "days_of_week") {
    if (!isDayOfWeek(columnKey)) return columnKey;
    return style === "long" ? DAY_LABEL_LONG[columnKey] : DAY_LABEL_SHORT[columnKey];
  }

  if (!isValidIsoDate(columnKey)) return columnKey;
  const [year, month, day] = columnKey.split("-").map(Number);
  const dow = isoDateToDayOfWeek(columnKey);
  const dayLabel = dow ? (style === "long" ? DAY_LABEL_LONG[dow] : DAY_LABEL_SHORT[dow]) : "";
  const monthLabel = style === "long" ? MONTH_LABEL_LONG[month - 1] : MONTH_LABEL_SHORT[month - 1];

  return style === "long"
    ? `${dayLabel}, ${day} ${monthLabel} ${year}`
    : `${dayLabel}, ${day} ${monthLabel}`;
}

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

export function formatDurationIndonesian(durationMinutes: number): string {
  if (durationMinutes <= 0) return "0 menit";
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam`;
  return `${minutes} menit`;
}
