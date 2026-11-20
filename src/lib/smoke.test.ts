import { describe, expect, it } from "vitest";
import { z } from "zod";

const sixDigitCodeSchema = z.string().regex(/^\d{6}$/, "Kode room harus 6 angka");

describe("tooling smoke check", () => {
  it("memvalidasi format kode room 6 digit menggunakan zod", () => {
    expect(sixDigitCodeSchema.safeParse("482910").success).toBe(true);
    expect(sixDigitCodeSchema.safeParse("4829").success).toBe(false);
    expect(sixDigitCodeSchema.safeParse("48291a").success).toBe(false);
  });
});
