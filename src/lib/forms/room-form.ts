import {
  DAYS_OF_WEEK_ORDER,
  isDayOfWeek,
  isValidIsoDate,
  normalizeColumns,
} from "@/lib/engine/slots";
import { normalizeParticipantName } from "@/lib/utils/room-code";
import type { DateMode } from "@/types/schedule";

export interface CalendarDayCell {
  isoDate: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

export interface CreateRoomDraft {
  title: string;
  description: string;
  hostName: string;
  dateMode: DateMode;
  dates: string[];
  startHour: number;
  endHour: number;
  rosterNames: string[];
}

export interface CreateRoomValidationErrors {
  title?: string;
  description?: string;
  hostName?: string;
  dates?: string;
  hours?: string;
  rosterNames?: string;
}

const MONTH_NAMES_ID = [
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

export function parseRosterInput(raw: string, existingNames: readonly string[] = []): string[] {
  const seen = new Set(existingNames.map((name) => normalizeParticipantName(name)));
  const result = [...existingNames];

  const tokens = raw.split(/[\n,;]+/);
  for (const token of tokens) {
    const cleaned = token.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const normalized = normalizeParticipantName(cleaned);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(cleaned);
  }

  return result;
}

export function getTodayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  if (!isValidIsoDate(isoDate)) {
    throw new RangeError(`Tanggal ISO tidak valid: ${isoDate}`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMonthYearIndonesian(year: number, monthIndex: number): string {
  const safeMonth = ((monthIndex % 12) + 12) % 12;
  return `${MONTH_NAMES_ID[safeMonth]} ${year}`;
}

/**
 * Membangun grid kalender Senin-Minggu (42 sel / 6 minggu) secara UTC-safe.
 */
export function buildCalendarMonthGrid(year: number, monthIndex: number): CalendarDayCell[] {
  const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekdayMonStart = (firstDayUtc.getUTCDay() + 6) % 7;
  const gridStartUtc = new Date(Date.UTC(year, monthIndex, 1 - firstWeekdayMonStart));

  const cells: CalendarDayCell[] = [];
  for (let offset = 0; offset < 42; offset += 1) {
    const current = new Date(gridStartUtc.getTime() + offset * 86_400_000);
    const y = current.getUTCFullYear();
    const m = current.getUTCMonth();
    const d = current.getUTCDate();
    cells.push({
      isoDate: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      dayNumber: d,
      inCurrentMonth: y === year && m === monthIndex,
    });
  }
  return cells;
}

export function formatHourOption(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function validateCreateRoomDraft(draft: CreateRoomDraft): CreateRoomValidationErrors {
  const errors: CreateRoomValidationErrors = {};
  const title = draft.title.trim().replace(/\s+/g, " ");
  const hostName = draft.hostName.trim().replace(/\s+/g, " ");
  const description = draft.description.trim();

  if (title.length < 3) {
    errors.title = "Judul jadwal minimal 3 karakter, misalnya Rapat Bab 3.";
  } else if (title.length > 100) {
    errors.title = "Judul jadwal maksimal 100 karakter.";
  }

  if (hostName.length < 1) {
    errors.hostName = "Masukkan namamu agar teman tahu siapa pembuat room ini.";
  } else if (hostName.length > 50) {
    errors.hostName = "Namamu maksimal 50 karakter.";
  }

  if (description.length < 3) {
    errors.description = "Deskripsi singkat wajib diisi (minimal 3 karakter).";
  } else if (description.length > 300) {
    errors.description = "Deskripsi maksimal 300 karakter.";
  }

  const validDates = normalizeColumns(draft.dateMode, draft.dates);
  if (validDates.length === 0) {
    errors.dates =
      draft.dateMode === "specific_dates"
        ? "Pilih minimal 1 tanggal di kalender."
        : "Pilih minimal 1 hari dalam seminggu.";
  } else if (validDates.length > 31) {
    errors.dates = "Maksimal 31 kolom tanggal dalam satu room.";
  }

  if (
    !Number.isInteger(draft.startHour) ||
    !Number.isInteger(draft.endHour) ||
    draft.startHour < 0 ||
    draft.startHour > 23 ||
    draft.endHour < 1 ||
    draft.endHour > 24 ||
    draft.endHour <= draft.startHour
  ) {
    errors.hours = "Jam selesai harus lebih akhir daripada jam mulai.";
  }

  if (draft.rosterNames.length > 60) {
    errors.rosterNames = "Daftar anggota maksimal 60 orang dalam satu room.";
  } else if (draft.rosterNames.some((name) => name.trim().length > 50)) {
    errors.rosterNames = "Setiap nama anggota maksimal 50 karakter.";
  }

  return errors;
}

export const ALL_WEEKLY_DAYS = DAYS_OF_WEEK_ORDER;
export { isDayOfWeek };
