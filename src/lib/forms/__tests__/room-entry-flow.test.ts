import { describe, expect, it } from "vitest";
import { parseRosterInput, validateCreateRoomDraft } from "@/lib/forms/room-form";
import { createLocalMockScheduleRepository } from "@/lib/repositories/schedule-repository";
import type { StorageLike } from "@/lib/storage/room-sessions";
import {
  formatRoomCodeDisplay,
  isValidRoomCode,
  sanitizeRoomCodeInput,
} from "@/lib/utils/room-code";

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

describe("Ticket 04 Create Room & Join 6-Digit Code Flow", () => {
  it("membuat room Tanggal Spesifik dengan roster lalu bergabung kembali memakai kode 6 digit", async () => {
    const sharedStorage = createMemoryStorage();
    const repoCreator = createLocalMockScheduleRepository({ storage: sharedStorage });
    const rosterNames = parseRosterInput("Andi, Budi, Citra, Dinda");
    const draft = {
      title: "Diskusi Tugas Akhir",
      description: "Bahas pembagian BAB 3",
      hostName: "Raka",
      dateMode: "specific_dates" as const,
      dates: ["2026-11-23", "2026-11-24", "2026-11-25"],
      startHour: 9,
      endHour: 21,
      rosterNames,
    };

    expect(validateCreateRoomDraft(draft)).toEqual({});

    const created = await repoCreator.createEvent({
      ...draft,
      timezone: "Asia/Jakarta",
      hostUid: "uid-raka",
      roomCodeGenerator: () => "127075",
    });

    expect(created.participants.map((p) => p.name)).toEqual(["Andi", "Budi", "Citra", "Dinda"]);
    expect(created.participants.every((p) => p.status === "pending")).toBe(true);

    // Simulasi user menyalin/menempel kode berspasi "127 075" di halaman /gabung pada instance repo terpisah
    const repoReader = createLocalMockScheduleRepository({ storage: sharedStorage });
    const sanitizedCode = sanitizeRoomCodeInput(" 127 075 ");
    expect(isValidRoomCode(sanitizedCode)).toBe(true);
    expect(formatRoomCodeDisplay(sanitizedCode)).toBe("127 075");

    const codeRecord = await repoReader.resolveRoomCode(sanitizedCode);
    expect(codeRecord).not.toBeNull();
    expect(codeRecord?.slug).toBe(created.event.slug);

    const loadedEvent = await repoReader.getEventBySlug(codeRecord!.slug);
    expect(loadedEvent?.title).toBe("Diskusi Tugas Akhir");

    const rakaProfile = await repoReader.getUserProfile("uid-raka");
    expect(rakaProfile?.recentEventSlugs[0]).toMatchObject({
      eventId: created.event.id,
      slug: created.event.slug,
      roomCode: "127075",
      role: "host",
    });
  });

  it("mengembalikan null saat kode 6 digit tidak terdaftar", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    expect(await repo.resolveRoomCode("000999")).toBeNull();
  });
});
