import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  buildCalendarMonthGrid,
  formatHourOption,
  formatMonthYearIndonesian,
  parseRosterInput,
  validateCreateRoomDraft,
} from "@/lib/forms/room-form";

describe("Room Form & Calendar Helpers", () => {
  it("memecah input roster dengan koma/baris baru dan mencegah duplikasi", () => {
    const firstBatch = parseRosterInput("Andi, Budi,\n  citra ; ANDI ");
    expect(firstBatch).toEqual(["Andi", "Budi", "citra"]);

    const merged = parseRosterInput("Dinda, budi, Eko", firstBatch);
    expect(merged).toEqual(["Andi", "Budi", "citra", "Dinda", "Eko"]);
  });

  it("menghitung tanggal ISO lintas bulan & tahun kabisat secara UTC-safe", () => {
    expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysIso("2026-11-29", 3)).toBe("2026-12-02");
  });

  it("membangun grid kalender Senin-Minggu (42 sel) dan nama bulan Indonesia", () => {
    expect(formatMonthYearIndonesian(2026, 10)).toBe("November 2026");

    // 1 Nov 2026 jatuh pada hari Minggu -> indeks terakhir minggu pertama
    const grid = buildCalendarMonthGrid(2026, 10);
    expect(grid).toHaveLength(42);
    expect(grid[0]).toEqual({ isoDate: "2026-10-26", dayNumber: 26, inCurrentMonth: false });
    expect(grid[6]).toEqual({ isoDate: "2026-11-01", dayNumber: 1, inCurrentMonth: true });
  });

  it("memformat jam opsi dengan leading zero", () => {
    expect(formatHourOption(8)).toBe("08:00");
    expect(formatHourOption(24)).toBe("24:00");
  });

  it("memvalidasi draf pembuatan room dan mengembalikan pesan ramah pengguna", () => {
    const invalid = validateCreateRoomDraft({
      title: "Ab",
      description: "",
      hostName: " ",
      dateMode: "specific_dates",
      dates: [],
      startHour: 20,
      endHour: 18,
      rosterNames: [],
    });

    expect(invalid.title).toBeDefined();
    expect(invalid.description).toBeDefined();
    expect(invalid.hostName).toBeDefined();
    expect(invalid.dates).toBeDefined();
    expect(invalid.hours).toBeDefined();

    const valid = validateCreateRoomDraft({
      title: "Rapat Bab 3",
      description: "Di perpustakaan",
      hostName: "Raka",
      dateMode: "days_of_week",
      dates: ["MON", "WED"],
      startHour: 8,
      endHour: 22,
      rosterNames: ["Andi", "Budi"],
    });
    expect(valid).toEqual({});
  });
});
