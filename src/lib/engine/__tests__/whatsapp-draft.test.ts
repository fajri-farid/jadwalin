import { describe, expect, it } from "vitest";
import { computeBestTimeWindows } from "@/lib/engine/heatmap";
import { buildWhatsAppDraft } from "@/lib/engine/whatsapp-draft";
import type { Participant, ScheduleEvent } from "@/types/schedule";

const BASE_EVENT: ScheduleEvent = {
  id: "ev-wa-1",
  slug: "rapat-bab-3-x9k2",
  roomCode: "482910",
  title: "Rapat Kelompok Bab 3",
  description: "Bahas revisi metodologi",
  dateMode: "specific_dates",
  dates: ["2026-11-23", "2026-11-24"],
  startHour: 18,
  endHour: 22,
  slotIntervalMin: 30,
  timezone: "Asia/Jakarta",
  hostUid: "uid-host",
  hostName: "Fajri",
  createdAt: 1700000000000,
};

function makeParticipant(
  overrides: Partial<Participant> & Pick<Participant, "id" | "name" | "status">
): Participant {
  return {
    eventId: BASE_EVENT.id,
    normalizedName: overrides.name.toLowerCase(),
    authType: overrides.status === "pending" ? "roster" : "guest",
    googleUid: null,
    pinHash: null,
    availabilities: {},
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe("buildWhatsAppDraft", () => {
  it("menghasilkan pesan personal saat semua anggota sudah isi dan membuang opsi lemah < 50%", () => {
    const participants: Participant[] = [
      makeParticipant({
        id: "p1",
        name: "Fajri",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          // Slot solo 1/3 -> tidak boleh muncul sebagai opsi #2
          "2026-11-24T18:00": "free",
          "2026-11-24T18:30": "free",
        },
      }),
      makeParticipant({
        id: "p2",
        name: "Andi",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
        },
      }),
      makeParticipant({
        id: "p3",
        name: "Citra",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
        },
      }),
    ];

    const { heatmap, bestWindows } = computeBestTimeWindows(BASE_EVENT, participants);
    const text = buildWhatsAppDraft({
      event: BASE_EVENT,
      heatmap,
      bestWindows,
      roomUrl: "https://jadwalin.app/r/rapat-bab-3-x9k2",
    });

    expect(text).toContain("Semua sudah isi jadwal *Rapat Kelompok Bab 3* (3/3)");
    expect(text).toContain("1. *Sen, 23 Nov, 19:00 - 20:00* (1 jam)");
    expect(text).toContain("Semua bisa (3/3): Fajri, Andi, Citra");
    expect(text).not.toContain("2. *");
    expect(text).not.toContain("Yang belum isi");
    expect(text).toContain("Kode Room: *482 910*");
  });

  it("menampilkan update sementara + tag belum isi dan mendukung sembunyikan pengingat", () => {
    const participants: Participant[] = [
      makeParticipant({
        id: "p1",
        name: "Fajri",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          "2026-11-24T20:00": "tentative",
          "2026-11-24T20:30": "tentative",
        },
      }),
      makeParticipant({
        id: "p2",
        name: "halo",
        status: "filled",
        availabilities: {
          "2026-11-23T19:00": "free",
          "2026-11-23T19:30": "free",
          "2026-11-24T20:00": "tentative",
          "2026-11-24T20:30": "tentative",
        },
      }),
      makeParticipant({ id: "p3", name: "hilo", status: "pending" }),
    ];

    const { heatmap, bestWindows } = computeBestTimeWindows(BASE_EVENT, participants);

    const withReminder = buildWhatsAppDraft({
      event: BASE_EVENT,
      heatmap,
      bestWindows,
      roomUrl: "http://localhost:3000/r/rapat-bab-3-x9k2",
      maxRecommendations: 3,
      includePendingReminder: true,
    });

    expect(withReminder).toContain("Update sementara *Rapat Kelompok Bab 3* (2/3 sudah isi)");
    expect(withReminder).toContain("Bisa (2/3): Fajri, halo");
    expect(withReminder).toContain("Diusahakan 50:50 (2): Fajri, halo");
    expect(withReminder).toContain("Yang belum isi (1): hilo");

    const withoutReminder = buildWhatsAppDraft({
      event: BASE_EVENT,
      heatmap,
      bestWindows,
      roomUrl: "http://localhost:3000/r/rapat-bab-3-x9k2",
      maxRecommendations: 1,
      includePendingReminder: false,
    });

    expect(withoutReminder).not.toContain("Yang belum isi");
    expect(withoutReminder).not.toContain("2. *");
  });

  it("menangani kondisi belum ada yang mengisi maupun kondisi tanpa irisan slot", () => {
    const allPending: Participant[] = [
      makeParticipant({ id: "p1", name: "Andi", status: "pending" }),
      makeParticipant({ id: "p2", name: "Budi", status: "pending" }),
    ];

    const pendingRes = computeBestTimeWindows(BASE_EVENT, allPending);
    const pendingDraft = buildWhatsAppDraft({
      event: BASE_EVENT,
      heatmap: pendingRes.heatmap,
      bestWindows: pendingRes.bestWindows,
      roomUrl: "https://jadwalin.app/r/rapat-bab-3-x9k2",
    });

    expect(pendingDraft).toContain("Yuk isi waktu luang kalian untuk *Rapat Kelompok Bab 3*");
    expect(pendingDraft).toContain("Yang ditunggu isiannya: Andi, Budi");

    const filledEmpty: Participant[] = [
      makeParticipant({ id: "p1", name: "Andi", status: "filled", availabilities: {} }),
    ];
    const emptyRes = computeBestTimeWindows(BASE_EVENT, filledEmpty);
    const emptyDraft = buildWhatsAppDraft({
      event: BASE_EVENT,
      heatmap: emptyRes.heatmap,
      bestWindows: emptyRes.bestWindows,
      roomUrl: "https://jadwalin.app/r/rapat-bab-3-x9k2",
    });

    expect(emptyDraft).toContain("Belum ada irisan jam kosong yang pas bareng-bareng.");
  });

  it("menghasilkan pesan sounding santai saat room sudah dikunci dengan jadwal kesepakatan", () => {
    const closedEvent: ScheduleEvent = {
      ...BASE_EVENT,
      status: "closed",
      closedAt: 1700000500000,
      agreedSlot: {
        columnKey: "2026-11-23",
        startTime: "19:00",
        endTime: "20:00",
      },
    };
    const participants: Participant[] = [
      makeParticipant({ id: "p1", name: "Fajri", status: "filled" }),
      makeParticipant({ id: "p2", name: "Andi", status: "filled" }),
    ];

    const { heatmap, bestWindows } = computeBestTimeWindows(closedEvent, participants);
    const draft = buildWhatsAppDraft({
      event: closedEvent,
      heatmap,
      bestWindows,
      roomUrl: "https://jadwalin.app/r/rapat-bab-3-x9k2",
    });

    expect(draft).toContain("Halo semuanya! Jadwal *Rapat Kelompok Bab 3* sudah fix ya:");
    expect(draft).toContain("*Senin, 23 November 2026 · 19:00 - 20:00*");
    expect(draft).toContain("Catatan: Bahas revisi metodologi");
    expect(draft).toContain("Jangan lupa catat waktunya, sampai ketemu!");
    expect(draft).not.toContain("Yang belum isi");
  });
});
