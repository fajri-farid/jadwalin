import { describe, expect, it } from "vitest";
import { computeBestTimeWindows, computeHeatmap } from "@/lib/engine/heatmap";
import type { Participant, SlotScheduleConfig } from "@/types/schedule";

function makeParticipant(
  overrides: Partial<Participant> & Pick<Participant, "id" | "name" | "status">
): Participant {
  return {
    eventId: "evt-1",
    normalizedName: overrides.name.toLowerCase(),
    authType: overrides.status === "pending" ? "roster" : "guest",
    googleUid: null,
    pinHash: null,
    availabilities: {},
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe("heatmap dan contiguous best time windows", () => {
  const baseConfig: SlotScheduleConfig = {
    dateMode: "specific_dates",
    dates: ["2026-11-23", "2026-11-24"],
    startHour: 19,
    endHour: 22,
  };

  it("menangani kondisi semua anggota masih pending tanpa error pembagian nol", () => {
    const participants: Participant[] = [
      makeParticipant({ id: "p1", name: "Andi", status: "pending" }),
      makeParticipant({ id: "p2", name: "Budi", status: "pending" }),
    ];

    const { heatmap, bestWindows } = computeBestTimeWindows(baseConfig, participants);
    expect(heatmap.filledCount).toBe(0);
    expect(heatmap.pendingCount).toBe(2);
    expect(heatmap.totalParticipantsCount).toBe(2);
    expect(heatmap.cellsBySlotKey["2026-11-23T19:00"].heatLevel).toBe(0);
    expect(heatmap.cellsBySlotKey["2026-11-23T19:00"].rawScore).toBe(0);
    expect(bestWindows).toEqual([]);
  });

  it("mengecualikan peserta pending dari pembagi skor dan menghitung level 0..4 dengan bobot 1.0 vs 0.6", () => {
    const participants: Participant[] = [
      makeParticipant({
        id: "raka",
        name: "Raka",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          "2026-11-23T20:00": "free",
          "2026-11-23T21:00": "tentative",
        },
      }),
      makeParticipant({
        id: "citra",
        name: "Citra",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "tentative",
          "2026-11-23T21:00": "tentative",
        },
      }),
      makeParticipant({
        id: "budi",
        name: "Budi",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
        },
      }),
      makeParticipant({
        id: "dinda",
        name: "Dinda",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
        },
      }),
      // Pending di roster tidak menurunkan persentase 4 peserta yang sudah mengisi
      makeParticipant({ id: "andi", name: "Andi", status: "pending" }),
    ];

    const heatmap = computeHeatmap(baseConfig, participants);
    expect(heatmap.filledCount).toBe(4);
    expect(heatmap.pendingCount).toBe(1);
    expect(heatmap.pendingParticipantNames).toEqual(["Andi"]);

    // 19:00 -> 4/4 free = 4.0 (ratio 1.0) -> Level 4
    const unanimous = heatmap.cellsBySlotKey["2026-11-23T19:00"];
    expect(unanimous.rawScore).toBe(4);
    expect(unanimous.ratio).toBe(1);
    expect(unanimous.heatLevel).toBe(4);
    expect(unanimous.isTentativeOnly).toBe(false);

    // 19:30 -> 1 free + 1 tentative = 1.6 / 4 = 0.4 -> Level 2
    const medium = heatmap.cellsBySlotKey["2026-11-23T19:30"];
    expect(medium.rawScore).toBe(1.6);
    expect(medium.ratio).toBe(0.4);
    expect(medium.heatLevel).toBe(2);
    expect(medium.unavailableNames).toEqual(["Budi", "Dinda"]);

    // 20:00 -> 1 free / 4 = 0.25 -> Level 1
    const low = heatmap.cellsBySlotKey["2026-11-23T20:00"];
    expect(low.rawScore).toBe(1);
    expect(low.ratio).toBe(0.25);
    expect(low.heatLevel).toBe(1);

    // 21:00 -> 2 tentative / 4 = 1.2 / 4 = 0.3 -> Level 1 & isTentativeOnly
    const tentativeOnly = heatmap.cellsBySlotKey["2026-11-23T21:00"];
    expect(tentativeOnly.rawScore).toBe(1.2);
    expect(tentativeOnly.heatLevel).toBe(1);
    expect(tentativeOnly.isTentativeOnly).toBe(true);
  });

  it("memastikan level 4 tidak aktif jika ada peserta Diusahakan walaupun rasio >= 0.65", () => {
    const participants: Participant[] = [
      makeParticipant({
        id: "p1",
        name: "Raka",
        status: "filled",
        availabilities: { "2026-11-23T19:00": "free" },
      }),
      makeParticipant({
        id: "p2",
        name: "Citra",
        status: "filled",
        availabilities: { "2026-11-23T19:00": "tentative" },
      }),
    ];

    const heatmap = computeHeatmap(baseConfig, participants);
    const cell = heatmap.cellsBySlotKey["2026-11-23T19:00"];
    expect(cell.ratio).toBe(0.8);
    expect(cell.heatLevel).toBe(3);
  });

  it("menggabungkan slot berurutan dengan prioritas ranking ketat dan fallback minSlots = 1", () => {
    const participants: Participant[] = [
      makeParticipant({
        id: "p1",
        name: "Raka",
        status: "filled",
        availabilities: {
          // Senin 19:00-20:00 (2 slot): 2 Bisa
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          // Selasa 19:00-20:30 (3 slot): 2 Bisa
          "2026-11-24T19:00": "free",
          "2026-11-24T19:30": "free",
          "2026-11-24T20:00": "free",
          // Senin 21:00-22:00 (2 slot): 2 Bisa + 1 Diusahakan
          "2026-11-23T21:00": "free",
          "2026-11-23T21:30": "free",
        },
      }),
      makeParticipant({
        id: "p2",
        name: "Budi",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          "2026-11-24T19:00": "free",
          "2026-11-24T19:30": "free",
          "2026-11-24T20:00": "free",
          "2026-11-23T21:00": "free",
          "2026-11-23T21:30": "free",
        },
      }),
      makeParticipant({
        id: "p3",
        name: "Citra",
        status: "filled",
        availabilities: {
          "2026-11-23T21:00": "tentative",
          "2026-11-23T21:30": "tentative",
        },
      }),
    ];

    const { bestWindows } = computeBestTimeWindows(baseConfig, participants, { limit: 5 });
    expect(bestWindows).toHaveLength(3);

    // #1: Senin 21:00 - 22:00 (2 Bisa + 1 Diusahakan = 3 hadir > 2 hadir)
    expect(bestWindows[0].columnKey).toBe("2026-11-23");
    expect(bestWindows[0].startTime).toBe("21:00");
    expect(bestWindows[0].endTime).toBe("22:00");
    expect(bestWindows[0].durationMinutes).toBe(60);
    expect(bestWindows[0].freeNames).toEqual(["Raka", "Budi"]);
    expect(bestWindows[0].tentativeNames).toEqual(["Citra"]);

    // #2: Selasa 19:00 - 20:30 (2 Bisa, durasi 90 menit mengalahkan Senin 60 menit)
    expect(bestWindows[1].columnKey).toBe("2026-11-24");
    expect(bestWindows[1].startTime).toBe("19:00");
    expect(bestWindows[1].endTime).toBe("20:30");
    expect(bestWindows[1].durationMinutes).toBe(90);

    // #3: Senin 19:00 - 20:00
    expect(bestWindows[2].columnKey).toBe("2026-11-23");
    expect(bestWindows[2].startTime).toBe("19:00");
    expect(bestWindows[2].endTime).toBe("20:00");

    // Uji fallback 30 menit (minSlots = 1) saat tidak ada blok 60 menit
    const singleSlotParticipants: Participant[] = [
      makeParticipant({
        id: "s1",
        name: "Raka",
        status: "filled",
        availabilities: { "2026-11-23T20:00": "tentative" },
      }),
    ];
    const singleFallback = computeBestTimeWindows(baseConfig, singleSlotParticipants);
    expect(singleFallback.bestWindows).toHaveLength(1);
    expect(singleFallback.bestWindows[0].durationMinutes).toBe(30);
    expect(singleFallback.bestWindows[0].startTime).toBe("20:00");
    expect(singleFallback.bestWindows[0].endTime).toBe("20:30");
    expect(singleFallback.bestWindows[0].isTentativeOnly).toBe(true);
  });

  it("mendukung mode days_of_week dan membatasi jumlah output sesuai limit", () => {
    const weeklyConfig: SlotScheduleConfig = {
      dateMode: "days_of_week",
      dates: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      startHour: 10,
      endHour: 12,
    };

    const participants: Participant[] = [
      makeParticipant({
        id: "u1",
        name: "Raka",
        status: "filled",
        availabilities: {
          "MON-10:00": "free",
          "MON-10:30": "free",
          "TUE-10:00": "free",
          "TUE-10:30": "free",
          "WED-10:00": "free",
          "WED-10:30": "free",
          "THU-10:00": "free",
          "THU-10:30": "free",
          "FRI-10:00": "free",
          "FRI-10:30": "free",
          "SAT-10:00": "free",
          "SAT-10:30": "free",
        },
      }),
    ];

    const { bestWindows } = computeBestTimeWindows(weeklyConfig, participants);
    expect(bestWindows).toHaveLength(5);
    expect(bestWindows.map((w) => w.columnKey)).toEqual(["MON", "TUE", "WED", "THU", "FRI"]);
  });
});
