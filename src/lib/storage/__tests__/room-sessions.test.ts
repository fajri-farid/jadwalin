import { describe, expect, it } from "vitest";
import {
  clearRoomSession,
  getRoomSession,
  listRoomSessions,
  ROOM_SESSIONS_STORAGE_KEY,
  saveRoomSession,
  type StorageLike,
} from "@/lib/storage/room-sessions";

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

describe("Guest Room Session Storage", () => {
  it("menyimpan, membaca, dan mempertahankan deviceToken untuk peserta yang sama", () => {
    const storage = createMemoryStorage();

    const first = saveRoomSession(
      "evt-1",
      { participantId: "p-andi", participantName: "Andi" },
      storage
    );
    expect(first).not.toBeNull();
    expect(first?.deviceToken.length).toBeGreaterThan(8);

    const updated = saveRoomSession(
      "evt-1",
      { participantId: "p-andi", participantName: "Andi Pratama" },
      storage
    );
    expect(updated?.deviceToken).toBe(first?.deviceToken);
    expect(getRoomSession("evt-1", storage)?.participantName).toBe("Andi Pratama");
  });

  it("membuat deviceToken baru saat berpindah peserta dan tidak menyimpan PIN", () => {
    const storage = createMemoryStorage();

    const first = saveRoomSession(
      "evt-1",
      { participantId: "p-andi", participantName: "Andi" },
      storage
    );
    const second = saveRoomSession(
      "evt-1",
      { participantId: "p-budi", participantName: "Budi" },
      storage
    );

    expect(second?.deviceToken).not.toBe(first?.deviceToken);
    const raw = storage.getItem(ROOM_SESSIONS_STORAGE_KEY) ?? "";
    expect(raw).not.toContain("pin");
    expect(Object.keys(listRoomSessions(storage))).toEqual(["evt-1"]);
  });

  it("menghapus sesi room spesifik dan membersihkan key saat seluruh sesi kosong", () => {
    const storage = createMemoryStorage();

    saveRoomSession("evt-1", { participantId: "p-1", participantName: "Andi" }, storage);
    saveRoomSession("evt-2", { participantId: "p-2", participantName: "Budi" }, storage);

    clearRoomSession("evt-1", storage);
    expect(getRoomSession("evt-1", storage)).toBeNull();
    expect(getRoomSession("evt-2", storage)?.participantName).toBe("Budi");

    clearRoomSession("evt-2", storage);
    expect(storage.getItem(ROOM_SESSIONS_STORAGE_KEY)).toBeNull();
  });
});
