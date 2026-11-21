import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ROOMS_PAGE_SIZE,
  filterAndSortDashboardRooms,
  paginateItems,
  prefilterDashboardSummaries,
  type DashboardRoomItem,
} from "@/lib/dashboard/room-filter";
import {
  createLocalMockScheduleRepository,
  RepositoryError,
} from "@/lib/repositories/schedule-repository";
import { formatRoomDateSummary, getRoomEffectiveStatus } from "@/lib/room/room-lifecycle";
import type { ScheduleEvent } from "@/types/schedule";

function makeEvent(overrides: Partial<ScheduleEvent>): ScheduleEvent {
  return {
    id: "ev-1",
    slug: "makan-brooo-1234",
    roomCode: "332767",
    title: "makan brooo!",
    description: "Cari tempat makan bareng dekat kampus",
    dateMode: "specific_dates",
    dates: ["2026-11-23", "2026-11-24"],
    startHour: 8,
    endHour: 20,
    slotIntervalMin: 30,
    timezone: "Asia/Singapore",
    hostUid: "uid-host",
    hostName: "Fajri",
    createdAt: 1700000000000,
    status: "open",
    closedAt: null,
    agreedSlot: null,
    ...overrides,
  };
}

describe("room lifecycle (manual close & auto-close) dan dashboard filter", () => {
  it("mendeteksi status aktif, tutup manual dengan jadwal fix, dan selesai otomatis saat tanggal lewat", () => {
    const openEvent = makeEvent({
      dates: ["2026-11-23", "2026-11-24"],
      endHour: 20,
      timezone: "Asia/Singapore",
    });

    // Sebelum 24 Nov 2026 20:00 SGT (UTC+8 => 12:00 UTC)
    const beforeEnd = Date.UTC(2026, 10, 24, 11, 0, 0);
    expect(getRoomEffectiveStatus(openEvent, beforeEnd)).toMatchObject({
      state: "open",
      isClosed: false,
    });

    // Setelah 24 Nov 2026 20:00 SGT -> auto-expired
    const afterEnd = Date.UTC(2026, 10, 24, 13, 0, 0);
    expect(getRoomEffectiveStatus(openEvent, afterEnd)).toMatchObject({
      state: "expired",
      isClosed: true,
      isAutoExpired: true,
    });

    // Mode mingguan tidak otomatis kadaluarsa
    const weeklyEvent = makeEvent({
      dateMode: "days_of_week",
      dates: ["MON", "WED", "FRI"],
    });
    expect(getRoomEffectiveStatus(weeklyEvent, afterEnd)).toMatchObject({
      state: "open",
      isClosed: false,
    });

    // Tutup manual dengan jadwal fix
    const fixedEvent = makeEvent({
      status: "closed",
      closedAt: beforeEnd,
      agreedSlot: { columnKey: "2026-11-23", startTime: "12:00", endTime: "13:00" },
    });
    expect(getRoomEffectiveStatus(fixedEvent, beforeEnd)).toMatchObject({
      state: "closed",
      isClosed: true,
      isManualClosed: true,
      hasAgreedSlot: true,
    });

    expect(formatRoomDateSummary(openEvent)).toBe("Sen, 23 Nov – Sel, 24 Nov");
    expect(formatRoomDateSummary(weeklyEvent)).toBe("Sen, Rab, Jum");
  });

  it("menyaring room berdasarkan judul atau kode 6 digit saja, filter peran/status, dan urutkan", () => {
    const evA = makeEvent({
      id: "ev-a",
      title: "makan brooo!",
      description: "kata-unik-hanya-di-deskripsi",
      roomCode: "332767",
      status: "open",
    });
    const evB = makeEvent({
      id: "ev-b",
      title: "Bimbingan Skripsi",
      description: "Ruang dosen lt 3",
      roomCode: "482910",
      status: "closed",
    });

    const items: DashboardRoomItem[] = [
      {
        summary: {
          eventId: evA.id,
          slug: evA.slug,
          roomCode: evA.roomCode,
          title: evA.title,
          role: "host",
          lastVisitedAt: 1000,
        },
        event: evA,
        filledCount: 1,
        totalMembers: 3,
        topWindow: null,
        effectiveStatus: getRoomEffectiveStatus(evA, Date.UTC(2026, 10, 22, 0, 0, 0)),
      },
      {
        summary: {
          eventId: evB.id,
          slug: evB.slug,
          roomCode: evB.roomCode,
          title: evB.title,
          role: "participant",
          lastVisitedAt: 2000,
        },
        event: evB,
        filledCount: 3,
        totalMembers: 3,
        topWindow: null,
        effectiveStatus: getRoomEffectiveStatus(evB, Date.UTC(2026, 10, 22, 0, 0, 0)),
      },
    ];

    // Cari berdasarkan judul
    expect(
      filterAndSortDashboardRooms(items, {
        query: "makan",
        roleFilter: "all",
        statusFilter: "all",
        sortBy: "recent",
      }).map((i) => i.summary.eventId)
    ).toEqual(["ev-a"]);

    // Cari berdasarkan kode berspasi "482 910"
    expect(
      filterAndSortDashboardRooms(items, {
        query: "482 910",
        roleFilter: "all",
        statusFilter: "all",
        sortBy: "recent",
      }).map((i) => i.summary.eventId)
    ).toEqual(["ev-b"]);

    // Tidak mencocokkan teks yang hanya ada di deskripsi (search khusus judul atau kode)
    expect(
      filterAndSortDashboardRooms(items, {
        query: "kata-unik-hanya-di-deskripsi",
        roleFilter: "all",
        statusFilter: "all",
        sortBy: "recent",
      })
    ).toHaveLength(0);

    // Filter status & sort judul A-Z
    expect(
      filterAndSortDashboardRooms(items, {
        query: "",
        roleFilter: "all",
        statusFilter: "closed",
        sortBy: "recent",
      }).map((i) => i.summary.eventId)
    ).toEqual(["ev-b"]);

    expect(
      filterAndSortDashboardRooms(items, {
        query: "",
        roleFilter: "all",
        statusFilter: "all",
        sortBy: "title",
      }).map((i) => i.summary.eventId)
    ).toEqual(["ev-b", "ev-a"]);
  });

  it("mengizinkan Host menutup/membuka room dan menolak edit peserta saat room tertutup", async () => {
    const repo = createLocalMockScheduleRepository({ storage: null });
    const created = await repo.createEvent({
      title: "Rapat Final",
      description: "Penentuan jadwal presentasi kelompok",
      dateMode: "specific_dates",
      dates: ["2026-11-23"],
      startHour: 10,
      endHour: 15,
      timezone: "Asia/Jakarta",
      hostUid: "uid-host",
      hostName: "Fajri",
      rosterNames: ["Andi"],
    });

    // Non-host ditolak menutup room
    await expect(
      repo.updateEventStatus({
        eventId: created.event.id,
        hostUid: "uid-lain",
        status: "closed",
      })
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED" } satisfies Partial<RepositoryError>);

    // Host menutup dengan jadwal fix
    const closed = await repo.updateEventStatus({
      eventId: created.event.id,
      hostUid: "uid-host",
      status: "closed",
      agreedSlot: { columnKey: "2026-11-23", startTime: "10:00", endTime: "12:00" },
    });
    expect(closed.status).toBe("closed");
    expect(closed.agreedSlot?.startTime).toBe("10:00");

    // Edit peserta saat room tertutup ditolak dengan ROOM_CLOSED
    await expect(
      repo.updateParticipantAvailability({
        eventId: created.event.id,
        participantId: created.participants[0].id,
        availabilities: { "2026-11-23T10:00": "free" },
      })
    ).rejects.toMatchObject({ code: "ROOM_CLOSED" } satisfies Partial<RepositoryError>);

    // Host membuka kembali -> peserta bisa mengisi lagi
    const reopened = await repo.updateEventStatus({
      eventId: created.event.id,
      hostUid: "uid-host",
      status: "open",
    });
    expect(reopened.status).toBe("open");
    expect(reopened.agreedSlot).toBeNull();

    const updated = await repo.updateParticipantAvailability({
      eventId: created.event.id,
      participantId: created.participants[0].id,
      availabilities: { "2026-11-23T10:00": "free" },
    });
    expect(updated.status).toBe("filled");
  });

  it("memecah daftar room menjadi pagination 6 per halaman dan pra-filter metadata tanpa baca ekstra", () => {
    const summaries = Array.from({ length: 14 }, (_, idx) => ({
      eventId: `ev-${idx + 1}`,
      slug: `room-${idx + 1}`,
      roomCode: String(100000 + idx),
      title: `Rapat Tim ${String(idx + 1).padStart(2, "0")}`,
      role: (idx % 2 === 0 ? "host" : "participant") as "host" | "participant",
      lastVisitedAt: 1000 + idx,
    }));

    expect(DASHBOARD_ROOMS_PAGE_SIZE).toBe(6);

    const page1 = paginateItems(summaries, 1);
    expect(page1.items).toHaveLength(6);
    expect(page1.totalPages).toBe(3);
    expect(page1.startIndex).toBe(1);
    expect(page1.endIndex).toBe(6);
    expect(page1.hasPrev).toBe(false);
    expect(page1.hasNext).toBe(true);

    const page3 = paginateItems(summaries, 99);
    expect(page3.page).toBe(3);
    expect(page3.items).toHaveLength(2);
    expect(page3.startIndex).toBe(13);
    expect(page3.endIndex).toBe(14);
    expect(page3.hasNext).toBe(false);

    const hostOnly = prefilterDashboardSummaries(summaries, {
      query: "",
      roleFilter: "host",
      sortBy: "recent",
    });
    expect(hostOnly).toHaveLength(7);
    expect(hostOnly[0]?.eventId).toBe("ev-13");
  });
});
