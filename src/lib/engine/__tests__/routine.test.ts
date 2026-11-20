import { describe, expect, it } from "vitest";
import {
  applyWeeklyRoutineToEvent,
  extractWeeklyRoutineFromAvailabilities,
} from "@/lib/engine/routine";
import type { AvailabilityMap, SlotScheduleConfig } from "@/types/schedule";

describe("weekly routine converter", () => {
  const sampleRoutine: AvailabilityMap = {
    "MON-19:00": "free",
    "MON-19:30": "free",
    "THU-20:00": "tentative",
    "SAT-09:00": "free", // di luar jam 19..21 pada beberapa room
  };

  it("menerapkan template mingguan pada room mode days_of_week dengan merge dan replace", () => {
    const config: SlotScheduleConfig = {
      dateMode: "days_of_week",
      dates: ["MON", "WED", "THU"],
      startHour: 19,
      endHour: 21,
    };

    const merged = applyWeeklyRoutineToEvent(sampleRoutine, config, {
      mode: "merge",
      existingAvailabilities: {
        "WED-19:00": "free",
        "MON-19:00": "tentative", // ditimpa routine menjadi free
        "SUN-19:00": "free", // di luar room -> disaring
      },
    });

    expect(merged.availabilities).toEqual({
      "WED-19:00": "free",
      "MON-19:00": "free",
      "MON-19:30": "free",
      "THU-20:00": "tentative",
    });
    expect(merged.appliedCount).toBe(3);
    expect(merged.skippedCount).toBe(1);

    const replaced = applyWeeklyRoutineToEvent(sampleRoutine, config, {
      mode: "replace",
      existingAvailabilities: { "WED-19:00": "free" },
    });
    expect(replaced.availabilities).toEqual({
      "MON-19:00": "free",
      "MON-19:30": "free",
      "THU-20:00": "tentative",
    });
  });

  it("menerapkan template mingguan ke banyak minggu specific_dates secara UTC-safe", () => {
    // 2026-11-23 & 2026-11-30 sama-sama Senin; 2024-02-29 adalah Kamis (tahun kabisat)
    const config: SlotScheduleConfig = {
      dateMode: "specific_dates",
      dates: ["2024-02-29", "2026-11-23", "2026-11-30"],
      startHour: 19,
      endHour: 21,
    };

    const result = applyWeeklyRoutineToEvent(sampleRoutine, config);
    expect(result.availabilities).toEqual({
      "2026-11-23T19:00": "free",
      "2026-11-23T19:30": "free",
      "2026-11-30T19:00": "free",
      "2026-11-30T19:30": "free",
      "2024-02-29T20:00": "tentative",
    });
    expect(result.appliedCount).toBe(5);
    expect(result.skippedCount).toBe(1); // SAT-09:00 tidak cocok tanggal & jam room
  });

  it("mengekstrak isian jadwal specific_dates kembali ke template mingguan DAY-HH:mm", () => {
    const config: SlotScheduleConfig = {
      dateMode: "specific_dates",
      dates: ["2026-11-23", "2026-11-25"],
      startHour: 19,
      endHour: 20,
    };

    const routine = extractWeeklyRoutineFromAvailabilities(
      {
        "2026-11-23T19:00": "free",
        "2026-11-25T19:30": "tentative",
        "2026-11-25T23:00": "free", // di luar jam room
      },
      config,
      { "FRI-18:00": "free" }
    );

    expect(routine).toEqual({
      "FRI-18:00": "free",
      "MON-19:00": "free",
      "WED-19:30": "tentative",
    });
  });
});
