import { describe, expect, it } from "vitest";
import { computeBestTimeWindows } from "@/lib/engine/heatmap";
import { createLocalMockScheduleRepository } from "@/lib/repositories/local-mock-repository";
import {
  applyPaintBatch,
  applyPaintToSlot,
  areAvailabilityMapsEqual,
  computeDisplayHeatLevel,
  computeTeammateSlotHints,
  countAvailabilityStats,
  pickSpatialNavigationTarget,
  resolveAutoSessionParticipant,
  resolveStrokeBrush,
  type SpatialCandidateRect,
} from "@/lib/room/grid-interaction";
import type { AuthUser } from "@/lib/firebase/auth";
import type { AvailabilityMap, Participant } from "@/types/schedule";

function createParticipant(overrides: Partial<Participant>): Participant {
  return {
    id: "p1",
    eventId: "ev1",
    name: "Andi",
    normalizedName: "andi",
    status: "pending",
    authType: "roster",
    googleUid: null,
    pinHash: null,
    availabilities: {},
    updatedAt: 1000,
    ...overrides,
  };
}

describe("grid-interaction helpers", () => {
  it("menerapkan kuas free, tentative, dan erase secara imutabel tanpa mutasi berlebih", () => {
    const empty: AvailabilityMap = {};
    expect(applyPaintToSlot(empty, "2026-11-23T09:00", "erase")).toBe(empty);

    const withFree = applyPaintToSlot(empty, "2026-11-23T09:00", "free");
    expect(withFree).toEqual({ "2026-11-23T09:00": "free" });
    expect(applyPaintToSlot(withFree, "2026-11-23T09:00", "free")).toBe(withFree);

    const withTentative = applyPaintToSlot(withFree, "2026-11-23T09:00", "tentative");
    expect(withTentative).toEqual({ "2026-11-23T09:00": "tentative" });

    const erased = applyPaintToSlot(withTentative, "2026-11-23T09:00", "erase");
    expect(erased).toEqual({});
  });

  it("menerapkan batch drag-paint dan toggle ergonomis pada ketukan sel berstatus sama", () => {
    const start: AvailabilityMap = { "2026-11-23T09:00": "free" };
    expect(resolveStrokeBrush(start, "2026-11-23T09:00", "free")).toBe("erase");
    expect(resolveStrokeBrush(start, "2026-11-23T09:30", "free")).toBe("free");
    expect(resolveStrokeBrush(start, "2026-11-23T09:00", "tentative")).toBe("tentative");

    const painted = applyPaintBatch(start, ["2026-11-23T09:30", "2026-11-23T10:00"], "tentative");
    expect(painted).toEqual({
      "2026-11-23T09:00": "free",
      "2026-11-23T09:30": "tentative",
      "2026-11-23T10:00": "tentative",
    });

    expect(countAvailabilityStats(painted)).toEqual({
      freeCount: 1,
      tentativeCount: 2,
      totalMarked: 3,
    });
    expect(areAvailabilityMapsEqual(painted, { ...painted })).toBe(true);
    expect(areAvailabilityMapsEqual(painted, start)).toBe(false);
  });

  it("mengenali sesi otomatis dari Google UID terlebih dahulu lalu device session", () => {
    const andi = createParticipant({ id: "p-andi", name: "Andi", googleUid: "uid-andi" });
    const budi = createParticipant({ id: "p-budi", name: "Budi", pinHash: "a".repeat(64) });
    const authUser: AuthUser = {
      uid: "uid-andi",
      displayName: "Andi",
      email: "andi@example.com",
      photoURL: null,
      provider: "google",
    };

    const byGoogle = resolveAutoSessionParticipant({
      participants: [andi, budi],
      authUser,
      savedSession: {
        participantId: "p-budi",
        participantName: "Budi",
        deviceToken: "dev-1",
        updatedAt: 2000,
      },
    });
    expect(byGoogle?.participant.id).toBe("p-andi");
    expect(byGoogle?.viaGoogle).toBe(true);

    const byDevice = resolveAutoSessionParticipant({
      participants: [andi, budi],
      authUser: null,
      savedSession: {
        participantId: "p-budi",
        participantName: "Budi",
        deviceToken: "dev-1",
        updatedAt: 2000,
      },
    });
    expect(byDevice?.participant.id).toBe("p-budi");
    expect(byDevice?.trustedDevice).toBe(true);

    // Sesi perangkat lama milik peserta yang terikat akun Google lain tidak boleh langsung dipercaya
    const blockedForeignGoogle = resolveAutoSessionParticipant({
      participants: [andi, budi],
      authUser: null,
      savedSession: {
        participantId: "p-andi",
        participantName: "Andi",
        deviceToken: "dev-stale",
        updatedAt: 2000,
      },
    });
    expect(blockedForeignGoogle).toBeNull();
  });

  it("menavigasi fokus 2D berdasarkan geometri visual dan mengembalikan null di tepi grid", () => {
    const rects: SpatialCandidateRect[] = [
      { id: "c0r0", rect: { left: 0, right: 80, top: 0, bottom: 40, width: 80, height: 40 } },
      { id: "c1r0", rect: { left: 84, right: 164, top: 0, bottom: 40, width: 80, height: 40 } },
      { id: "c0r1", rect: { left: 0, right: 80, top: 44, bottom: 84, width: 80, height: 40 } },
      { id: "c1r1", rect: { left: 84, right: 164, top: 44, bottom: 84, width: 80, height: 40 } },
      { id: "hidden", rect: { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 } },
    ];

    expect(pickSpatialNavigationTarget(rects[0], rects, "right")).toBe("c1r0");
    expect(pickSpatialNavigationTarget(rects[0], rects, "down")).toBe("c0r1");
    expect(pickSpatialNavigationTarget(rects[0], rects, "left")).toBeNull();
    expect(pickSpatialNavigationTarget(rects[0], rects, "up")).toBeNull();
    expect(pickSpatialNavigationTarget(rects[3], rects, "left")).toBe("c0r1");
    expect(pickSpatialNavigationTarget(rects[3], rects, "up")).toBe("c1r0");
  });

  it("menjalankan alur kolaborasi real-time: klaim roster, kunci PIN, simpan slot, dan hitung rekomendasi", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    const created = await repo.createEvent({
      title: "Rapat Proyek Akhir",
      dateMode: "specific_dates",
      dates: ["2026-11-23", "2026-11-24"],
      startHour: 18,
      endHour: 21,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host",
      hostName: "Fajri",
      rosterNames: ["Andi", "Budi"],
    });

    const snapshots: Participant[][] = [];
    const unsubscribe = repo.subscribeEventParticipants(created.event.id, (list) => {
      snapshots.push(list);
    });

    const andi = created.participants.find((item) => item.name === "Andi")!;
    const budi = created.participants.find((item) => item.name === "Budi")!;

    await repo.updateParticipantAvailability({
      eventId: created.event.id,
      participantId: andi.id,
      availabilities: {
        "2026-11-23T19:00": "free",
        "2026-11-23T19:30": "free",
      },
      newPin: "4321",
      trustedDevice: true,
    });

    // Verifikasi PIN diperlukan pada perangkat baru (trustedDevice = false)
    await expect(
      repo.claimOrCreateParticipant({
        eventId: created.event.id,
        participantId: andi.id,
        pin: "0000",
        trustedDevice: false,
      })
    ).rejects.toMatchObject({ code: "INVALID_PIN" });

    await repo.updateParticipantAvailability({
      eventId: created.event.id,
      participantId: budi.id,
      availabilities: {
        "2026-11-23T19:00": "free",
        "2026-11-23T19:30": "tentative",
      },
      trustedDevice: true,
    });

    unsubscribe();

    const latest = snapshots[snapshots.length - 1] ?? [];
    const { heatmap, bestWindows } = computeBestTimeWindows(created.event, latest, { limit: 3 });

    expect(heatmap.filledCount).toBe(2);
    expect(heatmap.cellsBySlotKey["2026-11-23T19:00"]?.heatLevel).toBe(4);
    expect(heatmap.cellsBySlotKey["2026-11-23T19:30"]?.tentativeCount).toBe(1);
    expect(bestWindows[0]?.startTime).toBe("19:00");
    expect(bestWindows[0]?.freeNames).toEqual(["Andi", "Budi"]);
  });

  it("mengumpulkan petunjuk slot teman selain peserta aktif dan menghitung intensitas 1/n secara jujur", () => {
    const fajri = createParticipant({
      id: "p-fajri",
      name: "Fajri",
      status: "filled",
      availabilities: {
        "2026-11-23T12:00": "free",
        "2026-11-23T15:30": "tentative",
      },
    });
    const halo = createParticipant({
      id: "p-halo",
      name: "halo",
      status: "filled",
      availabilities: {
        "2026-11-23T12:00": "free",
      },
    });
    const hilo = createParticipant({
      id: "p-hilo",
      name: "hilo",
      status: "pending",
    });

    const hintsForHalo = computeTeammateSlotHints([fajri, halo, hilo], "p-halo");
    expect(hintsForHalo.othersFilledCount).toBe(1);
    expect(hintsForHalo.hintsBySlotKey["2026-11-23T12:00"]).toEqual({
      freeNames: ["Fajri"],
      tentativeNames: [],
      freeCount: 1,
      tentativeCount: 0,
      totalCount: 1,
    });
    expect(hintsForHalo.hintsBySlotKey["2026-11-23T15:30"]).toEqual({
      freeNames: [],
      tentativeNames: ["Fajri"],
      freeCount: 0,
      tentativeCount: 1,
      totalCount: 1,
    });

    // 1 dari 3 anggota bisa = 0.3333 -> level 1 (bukan level 4 penuh!)
    expect(computeDisplayHeatLevel(1, 1, 3)).toBe(1);
    // 2 dari 3 anggota bisa = 0.6667 -> level 3
    expect(computeDisplayHeatLevel(2, 2, 3)).toBe(3);
    // 3 dari 3 anggota bisa = 1.0 -> level 4 (semua bisa!)
    expect(computeDisplayHeatLevel(3, 3, 3)).toBe(4);
  });
});
