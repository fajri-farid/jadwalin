import { describe, expect, it } from "vitest";
import {
  addMinutesToTime,
  buildTimeSlots,
  buildValidSlotKeys,
  createSlotKey,
  filterAvailabilitiesToEvent,
  formatColumnLabel,
  formatDurationIndonesian,
  formatTimeRange,
  isoDateToDayOfWeek,
  isValidIsoDate,
  normalizeColumns,
  parseSlotKey,
  parseTimeToMinutes,
} from "@/lib/engine/slots";

describe("slots engine", () => {
  it("memvalidasi tanggal kalender ISO termasuk tahun kabisat secara akurat", () => {
    expect(isValidIsoDate("2026-11-23")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-04-31")).toBe(false);
    expect(isValidIsoDate("23-11-2026")).toBe(false);
  });

  it("mengonversi tanggal ISO ke kode hari UTC-safe", () => {
    expect(isoDateToDayOfWeek("2026-11-23")).toBe("MON");
    expect(isoDateToDayOfWeek("2026-11-29")).toBe("SUN");
    expect(isoDateToDayOfWeek("2024-02-29")).toBe("THU");
    expect(isoDateToDayOfWeek("2026-02-29")).toBeNull();
  });

  it("membangun daftar slot waktu 30 menitan dan memvalidasi batas jam", () => {
    const slots = buildTimeSlots(8, 10);
    expect(slots).toEqual(["08:00", "08:30", "09:00", "09:30"]);
    expect(buildTimeSlots(0, 24)).toHaveLength(48);

    expect(parseTimeToMinutes("19:30")).toBe(1170);
    expect(addMinutesToTime("23:30", 30)).toBe("24:00");

    expect(() => buildTimeSlots(-1, 12)).toThrow(RangeError);
    expect(() => buildTimeSlots(14, 14)).toThrow(RangeError);
    expect(() => buildTimeSlots(8, 25)).toThrow(RangeError);
    expect(() => buildTimeSlots(8, 12, 25)).toThrow(RangeError);
  });

  it("membuat dan mem-parse slotKey mode specific_dates dan days_of_week", () => {
    const specificKey = createSlotKey("specific_dates", "2026-11-24", "19:00");
    expect(specificKey).toBe("2026-11-24T19:00");
    expect(parseSlotKey(specificKey)).toEqual({
      dateMode: "specific_dates",
      columnKey: "2026-11-24",
      time: "19:00",
    });

    const weeklyKey = createSlotKey("days_of_week", "FRI", "08:30");
    expect(weeklyKey).toBe("FRI-08:30");
    expect(parseSlotKey(weeklyKey)).toEqual({
      dateMode: "days_of_week",
      columnKey: "FRI",
      time: "08:30",
    });

    expect(parseSlotKey("2026-02-29T19:00")).toBeNull();
    expect(parseSlotKey("2026-11-24T24:00")).toBeNull();
    expect(parseSlotKey("INVALID-08:00")).toBeNull();
  });

  it("menormalisasi urutan kolom dan menyaring slotKey di luar room aktif", () => {
    expect(
      normalizeColumns("specific_dates", ["2026-11-25", "2026-11-23", "2026-11-23", "bad-date"])
    ).toEqual(["2026-11-23", "2026-11-25"]);
    expect(normalizeColumns("days_of_week", ["FRI", "MON", "WED", "MON", "XXX"])).toEqual([
      "MON",
      "WED",
      "FRI",
    ]);

    const config = {
      dateMode: "days_of_week" as const,
      dates: ["MON", "WED"],
      startHour: 19,
      endHour: 20,
    };
    expect(buildValidSlotKeys(config)).toEqual([
      "MON-19:00",
      "MON-19:30",
      "WED-19:00",
      "WED-19:30",
    ]);

    const filtered = filterAvailabilitiesToEvent(
      {
        "MON-19:00": "free",
        "MON-21:00": "free",
        "SUN-19:00": "tentative",
        "WED-19:30": "tentative",
      },
      config
    );
    expect(filtered).toEqual({
      "MON-19:00": "free",
      "WED-19:30": "tentative",
    });
  });

  it("memformat label hari, tanggal, rentang jam, dan durasi dalam Bahasa Indonesia", () => {
    expect(formatColumnLabel("days_of_week", "THU", "short")).toBe("Kam");
    expect(formatColumnLabel("days_of_week", "THU", "long")).toBe("Kamis");
    expect(formatColumnLabel("specific_dates", "2026-11-23", "short")).toBe("Sen, 23 Nov");
    expect(formatColumnLabel("specific_dates", "2026-11-23", "long")).toBe(
      "Senin, 23 November 2026"
    );
    expect(formatTimeRange("19:00", "21:00")).toBe("19:00 - 21:00");
    expect(formatDurationIndonesian(120)).toBe("2 jam");
    expect(formatDurationIndonesian(90)).toBe("1 jam 30 menit");
    expect(formatDurationIndonesian(30)).toBe("30 menit");
  });
});
