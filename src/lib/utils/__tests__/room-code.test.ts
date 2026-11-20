import { describe, expect, it } from "vitest";
import {
  formatRoomCodeDisplay,
  generateRoomCode,
  generateRoomSlug,
  isValidRoomCode,
  normalizeParticipantName,
  sanitizeRoomCodeInput,
} from "@/lib/utils/room-code";

describe("room code & slug utilities", () => {
  it("memvalidasi, membersihkan, memformat, dan menghasilkan kode room 6 digit", () => {
    expect(isValidRoomCode("482910")).toBe(true);
    expect(isValidRoomCode("000123")).toBe(true);
    expect(isValidRoomCode("48291")).toBe(false);
    expect(isValidRoomCode("48291a")).toBe(false);

    expect(sanitizeRoomCodeInput("Kode: 482-910 99")).toBe("482910");
    expect(formatRoomCodeDisplay("482910")).toBe("482 910");
    expect(formatRoomCodeDisplay("4829")).toBe("482 9");

    expect(generateRoomCode(() => 42)).toBe("000042");
    const randomCode = generateRoomCode();
    expect(isValidRoomCode(randomCode)).toBe(true);
  });

  it("menormalisasi nama peserta untuk mencegah duplikat di roster", () => {
    expect(normalizeParticipantName("  Raka   Pratama  ")).toBe("raka pratama");
    expect(normalizeParticipantName("CITRA")).toBe("citra");
  });

  it("menghasilkan slug URL ramah baca beserta fallback judul non-alfanumerik", () => {
    expect(generateRoomSlug("Rapat Kelompok Bab 3!", "X8K2")).toBe("rapat-kelompok-bab-3-x8k2");
    expect(generateRoomSlug("Café & Diskusi TA", "a1b2")).toBe("cafe-diskusi-ta-a1b2");
    expect(generateRoomSlug("!!!", "9z8y")).toBe("jadwal-9z8y");
    expect(generateRoomSlug("Kumpul Panitia Wisuda")).toMatch(
      /^kumpul-panitia-wisuda-[a-z0-9]{4}$/
    );
  });
});
