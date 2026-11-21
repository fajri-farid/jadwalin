import { formatColumnLabel, isValidIsoDate } from "@/lib/engine/slots";
import type { ScheduleEvent } from "@/types/schedule";

export type RoomEffectiveState = "open" | "closed" | "expired";

export interface RoomEffectiveStatus {
  state: RoomEffectiveState;
  isClosed: boolean;
  isManualClosed: boolean;
  isAutoExpired: boolean;
  hasAgreedSlot: boolean;
}

/**
 * Mengonversi tanggal & jam lokal pada zona waktu IANA tertentu menjadi epoch ms secara akurat.
 */
function zonedDateTimeToEpochMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string
): number {
  const approxUtc = Date.UTC(year, month - 1, day, hour, 0, 0);

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    const parts = formatter.formatToParts(new Date(approxUtc));
    const lookup = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    const renderedUtc = Date.UTC(
      lookup("year"),
      lookup("month") - 1,
      lookup("day"),
      lookup("hour"),
      lookup("minute"),
      lookup("second")
    );
    const offsetMs = renderedUtc - approxUtc;
    return approxUtc - offsetMs;
  } catch {
    return approxUtc;
  }
}

/**
 * Menghitung batas waktu berakhir otomatis (epoch ms) untuk room bertipe `specific_dates`.
 * Room bertipe `days_of_week` (mingguan berulang) tidak otomatis kadaluarsa (`null`).
 */
export function getEventExpiryTimestamp(
  event: Pick<ScheduleEvent, "dateMode" | "dates" | "endHour" | "timezone">
): number | null {
  if (event.dateMode !== "specific_dates") return null;

  const validDates = event.dates.filter(isValidIsoDate).sort((a, b) => a.localeCompare(b));
  const lastDate = validDates[validDates.length - 1];
  if (!lastDate) return null;

  const [year, month, day] = lastDate.split("-").map(Number);
  if (event.endHour >= 24) {
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    return zonedDateTimeToEpochMs(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate(),
      0,
      event.timezone || "Asia/Jakarta"
    );
  }

  return zonedDateTimeToEpochMs(year, month, day, event.endHour, event.timezone || "Asia/Jakarta");
}

export function isEventExpired(
  event: Pick<ScheduleEvent, "dateMode" | "dates" | "endHour" | "timezone">,
  nowMs: number = Date.now()
): boolean {
  const expiry = getEventExpiryTimestamp(event);
  if (expiry === null) return false;
  return nowMs >= expiry;
}

export function getRoomEffectiveStatus(
  event: Pick<
    ScheduleEvent,
    "status" | "agreedSlot" | "dateMode" | "dates" | "endHour" | "timezone"
  >,
  nowMs: number = Date.now()
): RoomEffectiveStatus {
  if (event.status === "closed") {
    return {
      state: "closed",
      isClosed: true,
      isManualClosed: true,
      isAutoExpired: false,
      hasAgreedSlot: Boolean(event.agreedSlot),
    };
  }

  if (isEventExpired(event, nowMs)) {
    return {
      state: "expired",
      isClosed: true,
      isManualClosed: false,
      isAutoExpired: true,
      hasAgreedSlot: false,
    };
  }

  return {
    state: "open",
    isClosed: false,
    isManualClosed: false,
    isAutoExpired: false,
    hasAgreedSlot: false,
  };
}

/**
 * Meringkas daftar tanggal/hari room agar ringkas dibaca pada kartu Dashboard.
 */
export function formatRoomDateSummary(event: Pick<ScheduleEvent, "dateMode" | "dates">): string {
  if (event.dates.length === 0) return "Belum ada hari";
  if (event.dates.length === 1) {
    return formatColumnLabel(event.dateMode, event.dates[0], "short");
  }

  if (event.dateMode === "days_of_week") {
    if (event.dates.length <= 3) {
      return event.dates.map((d) => formatColumnLabel("days_of_week", d, "short")).join(", ");
    }
    const first = formatColumnLabel("days_of_week", event.dates[0], "short");
    const last = formatColumnLabel("days_of_week", event.dates[event.dates.length - 1], "short");
    return `${first} – ${last} (${event.dates.length} hari)`;
  }

  const first = formatColumnLabel("specific_dates", event.dates[0], "short");
  const last = formatColumnLabel("specific_dates", event.dates[event.dates.length - 1], "short");
  return `${first} – ${last}`;
}
