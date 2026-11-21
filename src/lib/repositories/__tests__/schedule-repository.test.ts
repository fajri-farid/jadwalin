import { describe, expect, it } from "vitest";
import {
  createLocalMockScheduleRepository,
  RepositoryError,
} from "@/lib/repositories/schedule-repository";
import type { StorageLike } from "@/lib/storage/room-sessions";
import type { Participant } from "@/types/schedule";

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe("LocalMockScheduleRepository", () => {
  it("membuat room beserta roster deduplikasi dan lookup kode 6 digit", async () => {
    const repo = createLocalMockScheduleRepository({ storage: createMemoryStorage() });

    const created = await repo.createEvent({
      title: "Diskusi Skripsi Bab 3",
      description: "Finalisasi jadwal bimbingan",
      dateMode: "specific_dates",
      dates: ["2026-11-24", "2026-11-23", "2026-11-23"],
      startHour: 8,
      endHour: 20,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host-andi",
      hostName: "Andi",
      rosterNames: ["Budi", "  budi ", "Andi", "Citra", ""],
      roomCodeGenerator: () => "482910",
    });

    const hostProfile = await repo.getUserProfile("uid-host-andi");
    expect(hostProfile?.recentEventSlugs[0]).toMatchObject({
      eventId: created.event.id,
      role: "host",
    });

    expect(created.event.roomCode).toBe("482910");
    expect(created.event.dates).toEqual(["2026-11-23", "2026-11-24"]);
    expect(created.participants).toHaveLength(3);
    expect(
      created.participants.every((p) => p.status === "pending" && p.authType === "roster")
    ).toBe(true);

    const lookup = await repo.resolveRoomCode("482910");
    expect(lookup?.eventId).toBe(created.event.id);
    expect(lookup?.slug).toBe(created.event.slug);

    expect(await repo.resolveRoomCode("999999")).toBeNull();
    expect(await repo.resolveRoomCode("12345")).toBeNull();

    const bySlug = await repo.getEventBySlug(created.event.slug);
    expect(bySlug?.id).toBe(created.event.id);
  });

  it("menolak pembuatan room bila hostUid kosong (AUTH_REQUIRED)", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });

    await expect(
      repo.createEvent({
        title: "Room Tanpa Login",
        description: "Rapat singkat di lab",
        dateMode: "days_of_week",
        dates: ["MON"],
        startHour: 9,
        endHour: 17,
        timezone: "Asia/Jakarta",
        hostUid: "   ",
        hostName: "Anonim",
      })
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" } satisfies Partial<RepositoryError>);
  });

  it("melakukan retry otomatis saat kode 6 digit bentrok dan gagal setelah 10 bentrokan", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });

    await repo.createEvent({
      title: "Room Pertama",
      description: "Diskusi pertama tim",
      dateMode: "days_of_week",
      dates: ["MON", "WED"],
      startHour: 9,
      endHour: 17,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host",
      hostName: "Host",
      roomCodeGenerator: () => "111222",
    });

    const second = await repo.createEvent({
      title: "Room Kedua",
      description: "Diskusi kedua tim",
      dateMode: "days_of_week",
      dates: ["MON", "WED"],
      startHour: 9,
      endHour: 17,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host",
      hostName: "Host",
      roomCodeGenerator: (attempt) => (attempt === 0 ? "111222" : "333444"),
    });
    expect(second.roomCode.code).toBe("333444");

    await expect(
      repo.createEvent({
        title: "Room Bentrok Terus",
        description: "Diskusi uji bentrok kode",
        dateMode: "days_of_week",
        dates: ["MON"],
        startHour: 9,
        endHour: 17,
        timezone: "Asia/Jakarta",
        hostUid: "uid-host",
        hostName: "Host",
        roomCodeGenerator: () => "111222",
      })
    ).rejects.toMatchObject({ code: "ROOM_CODE_COLLISION" } satisfies Partial<RepositoryError>);
  });

  it("mengenkripsi PIN 4 digit dengan SHA-256, memblokir PIN salah, dan mengizinkan trustedDevice", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    const created = await repo.createEvent({
      title: "Rapat HIMA",
      description: "Koordinasi acara proker",
      dateMode: "specific_dates",
      dates: ["2026-11-23"],
      startHour: 10,
      endHour: 14,
      timezone: "Asia/Jakarta",
      hostUid: "uid-andi",
      hostName: "Andi",
      rosterNames: ["Budi"],
    });

    const budi = created.participants[0];
    const claimed = await repo.claimOrCreateParticipant({
      eventId: created.event.id,
      participantId: budi.id,
      newPin: "4567",
      availabilities: {
        "2026-11-23T10:00": "free",
        "2026-11-23T07:00": "free",
      },
    });

    expect(claimed.status).toBe("filled");
    expect(claimed.authType).toBe("guest");
    expect(claimed.pinHash).toMatch(/^[a-f0-9]{64}$/);
    expect(claimed.pinHash).not.toBe("4567");
    expect(claimed.availabilities).toEqual({ "2026-11-23T10:00": "free" });

    expect(
      await repo.verifyParticipantAccess({
        eventId: created.event.id,
        participantId: budi.id,
        pin: "0000",
      })
    ).toBe(false);
    expect(
      await repo.verifyParticipantAccess({
        eventId: created.event.id,
        participantId: budi.id,
        pin: "4567",
      })
    ).toBe(true);

    await expect(
      repo.updateParticipantAvailability({
        eventId: created.event.id,
        participantId: budi.id,
        pin: "0000",
        availabilities: { "2026-11-23T11:00": "tentative" },
      })
    ).rejects.toMatchObject({ code: "INVALID_PIN" } satisfies Partial<RepositoryError>);

    const updatedWithPin = await repo.updateParticipantAvailability({
      eventId: created.event.id,
      participantId: budi.id,
      pin: "4567",
      availabilities: { "2026-11-23T11:00": "tentative" },
    });
    expect(updatedWithPin.availabilities).toEqual({ "2026-11-23T11:00": "tentative" });

    const updatedTrusted = await repo.updateParticipantAvailability({
      eventId: created.event.id,
      participantId: budi.id,
      trustedDevice: true,
      availabilities: { "2026-11-23T12:00": "free" },
    });
    expect(updatedTrusted.availabilities).toEqual({ "2026-11-23T12:00": "free" });
  });

  it("menolak duplikasi nama walk-in dan melindungi peserta terikat akun Google", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    const created = await repo.createEvent({
      title: "Rapat Proyek",
      description: "Pembagian modul tugas",
      dateMode: "days_of_week",
      dates: ["MON", "TUE"],
      startHour: 8,
      endHour: 12,
      timezone: "Asia/Jakarta",
      hostUid: "uid-citra",
      hostName: "Citra",
      rosterNames: ["Dewi"],
    });

    await expect(
      repo.claimOrCreateParticipant({
        eventId: created.event.id,
        name: "  dewi ",
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_PARTICIPANT_NAME",
    } satisfies Partial<RepositoryError>);

    const walkIn = await repo.claimOrCreateParticipant({
      eventId: created.event.id,
      name: "Eko",
      googleUid: "uid-eko",
      availabilities: { "MON-08:00": "free" },
    });
    expect(walkIn.authType).toBe("google");
    expect(walkIn.googleUid).toBe("uid-eko");

    await expect(
      repo.updateParticipantAvailability({
        eventId: created.event.id,
        participantId: walkIn.id,
        googleUid: "uid-orang-lain",
        availabilities: { "MON-09:00": "free" },
      })
    ).rejects.toMatchObject({ code: "GOOGLE_ACCOUNT_MISMATCH" } satisfies Partial<RepositoryError>);
  });

  it("mendukung pembaruan paralel tanpa hilang data, listener real-time, dan cleanup unsubscribe", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    const created = await repo.createEvent({
      title: "Kerja Kelompok Paralel",
      description: "Sinkronisasi paralel anggota",
      dateMode: "days_of_week",
      dates: ["FRI"],
      startHour: 13,
      endHour: 18,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host",
      hostName: "Host",
      rosterNames: ["Fajar", "Gita", "Hana"],
    });

    const snapshots: Participant[][] = [];
    const unsubscribe = repo.subscribeEventParticipants(created.event.id, (list) => {
      snapshots.push(list);
    });
    expect(snapshots).toHaveLength(1);

    await Promise.all(
      created.participants.map((participant, index) =>
        repo.updateParticipantAvailability({
          eventId: created.event.id,
          participantId: participant.id,
          availabilities: { [`FRI-${13 + index}:00`]: "free" },
        })
      )
    );

    const finalList = await repo.listParticipants(created.event.id);
    expect(finalList.filter((p) => p.status === "filled")).toHaveLength(3);
    expect(snapshots.length).toBeGreaterThanOrEqual(4);

    const countBeforeUnsub = snapshots.length;
    unsubscribe();

    await repo.claimOrCreateParticipant({
      eventId: created.event.id,
      name: "Indra",
      availabilities: { "FRI-16:00": "tentative" },
    });
    expect(snapshots).toHaveLength(countBeforeUnsub);
  });

  it("mengelola userProfile, menyaring weeklyRoutine, membatasi 30 riwayat, dan bertahan di storage", async () => {
    const sharedStorage = createMemoryStorage();
    const repoA = createLocalMockScheduleRepository({ storage: sharedStorage });

    await repoA.ensureUserProfile({
      uid: "u-123",
      displayName: "Nadia",
      email: "nadia@example.com",
    });

    const savedProfile = await repoA.saveWeeklyRoutine("u-123", {
      "MON-09:00": "free",
      "SUN-19:30": "tentative",
      "INVALID-KEY": "free",
    });
    expect(savedProfile.weeklyRoutine).toEqual({
      "MON-09:00": "free",
      "SUN-19:30": "tentative",
    });

    for (let i = 1; i <= 35; i += 1) {
      await repoA.recordUserEventVisit("u-123", {
        eventId: `evt-${i}`,
        slug: `slug-${i}`,
        roomCode: String(100000 + i),
        title: `Event ${i}`,
        role: i % 2 === 0 ? "host" : "participant",
        lastVisitedAt: 1000 + i,
      });
    }

    const repoB = createLocalMockScheduleRepository({ storage: sharedStorage });
    const reloaded = await repoB.getUserProfile("u-123");
    expect(reloaded?.recentEventSlugs).toHaveLength(30);
    expect(reloaded?.recentEventSlugs[0]?.eventId).toBe("evt-35");
  });
});
