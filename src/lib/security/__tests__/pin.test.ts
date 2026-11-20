import { describe, expect, it } from "vitest";
import { hashParticipantPin, isValidPin, verifyParticipantPin } from "@/lib/security/pin";

describe("keamanan hash PIN peserta 4 digit", () => {
  it("memvalidasi format PIN tepat 4 angka", () => {
    expect(isValidPin("0429")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("menghasilkan hash SHA-256 bersalt yang berbeda dari plaintext dan konsisten", async () => {
    const hashA = await hashParticipantPin("0429", "evt-1:raka");
    const hashASame = await hashParticipantPin("0429", "evt-1:raka");
    const hashOtherSalt = await hashParticipantPin("0429", "evt-2:raka");

    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    expect(hashA).not.toContain("0429");
    expect(hashA).toBe(hashASame);
    expect(hashA).not.toBe(hashOtherSalt);

    await expect(hashParticipantPin("123", "evt-1:raka")).rejects.toThrow(RangeError);
    await expect(hashParticipantPin("0429", "   ")).rejects.toThrow(RangeError);
  });

  it("memverifikasi PIN dengan tepat dan menolak kecocokan palsu atau format cacat", async () => {
    const salt = "evt-482910:citra";
    const pinHash = await hashParticipantPin("7391", salt);

    expect(await verifyParticipantPin("7391", salt, pinHash)).toBe(true);
    expect(await verifyParticipantPin("7391", salt, pinHash.toUpperCase())).toBe(true);
    expect(await verifyParticipantPin("7392", salt, pinHash)).toBe(false);
    expect(await verifyParticipantPin("7391", "evt-482910:budi", pinHash)).toBe(false);
    expect(await verifyParticipantPin("7391", salt, null)).toBe(false);
    expect(await verifyParticipantPin("7391", salt, "bukan-hash-sha256")).toBe(false);
    expect(await verifyParticipantPin("73", salt, pinHash)).toBe(false);
  });
});
