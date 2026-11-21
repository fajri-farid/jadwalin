import type { RoomEffectiveStatus } from "@/lib/room/room-lifecycle";
import type { BestTimeWindow, ScheduleEvent, UserEventSummary } from "@/types/schedule";

export type DashboardRoleFilter = "all" | "host" | "participant";
export type DashboardStatusFilter = "all" | "open" | "closed";
export type DashboardSortOption = "recent" | "title" | "progress";

export const DASHBOARD_ROOMS_PAGE_SIZE = 6;

export interface DashboardRoomItem {
  summary: UserEventSummary;
  event: ScheduleEvent | null;
  filledCount: number;
  totalMembers: number;
  topWindow: BestTimeWindow | null;
  effectiveStatus: RoomEffectiveStatus;
}

export interface DashboardFilterOptions {
  query: string;
  roleFilter: DashboardRoleFilter;
  statusFilter: DashboardStatusFilter;
  sortBy: DashboardSortOption;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Mencocokkan kata kunci pencarian pada **judul room** atau **kode 6 digit** (toleran spasi).
 */
export function matchesDashboardRoomQuery(
  title: string,
  roomCode: string,
  rawQuery: string
): boolean {
  const cleaned = rawQuery.trim().toLowerCase();
  if (!cleaned) return true;

  const numericQuery = cleaned.replace(/\D/g, "");
  const matchesTitle = title.toLowerCase().includes(cleaned);
  const matchesCode = numericQuery.length > 0 && roomCode.replace(/\D/g, "").includes(numericQuery);
  return matchesTitle || matchesCode;
}

/**
 * Pra-filter ringan pada metadata `UserEventSummary` (0 bacaan Firestore tambahan)
 * untuk menentukan room mana yang perlu dimuat detailnya pada halaman aktif.
 */
export function prefilterDashboardSummaries(
  summaries: readonly UserEventSummary[],
  options: {
    query: string;
    roleFilter: DashboardRoleFilter;
    sortBy: DashboardSortOption;
  }
): UserEventSummary[] {
  const filtered = summaries.filter((summary) => {
    if (options.roleFilter !== "all" && summary.role !== options.roleFilter) {
      return false;
    }
    return matchesDashboardRoomQuery(summary.title, summary.roomCode, options.query);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (options.sortBy === "title") {
      return a.title.localeCompare(b.title, "id", { sensitivity: "base" });
    }
    return b.lastVisitedAt - a.lastVisitedAt;
  });

  return sorted;
}

/**
 * Menyaring dan mengurutkan daftar room lengkap di `/dashboard`.
 * Pencarian (`query`) hanya mencocokkan **judul room** atau **kode room 6 digit** (toleran spasi).
 */
export function filterAndSortDashboardRooms(
  items: readonly DashboardRoomItem[],
  options: DashboardFilterOptions
): DashboardRoomItem[] {
  const filtered = items.filter((item) => {
    if (options.roleFilter !== "all" && item.summary.role !== options.roleFilter) {
      return false;
    }

    if (options.statusFilter === "open" && item.effectiveStatus.isClosed) {
      return false;
    }
    if (options.statusFilter === "closed" && !item.effectiveStatus.isClosed) {
      return false;
    }

    const titleText = item.event?.title ?? item.summary.title;
    const roomCode = item.event?.roomCode ?? item.summary.roomCode;
    return matchesDashboardRoomQuery(titleText, roomCode, options.query);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (options.sortBy === "title") {
      const titleA = a.event?.title ?? a.summary.title;
      const titleB = b.event?.title ?? b.summary.title;
      return titleA.localeCompare(titleB, "id", { sensitivity: "base" });
    }

    if (options.sortBy === "progress") {
      const ratioA = a.totalMembers > 0 ? a.filledCount / a.totalMembers : 0;
      const ratioB = b.totalMembers > 0 ? b.filledCount / b.totalMembers : 0;
      if (ratioB !== ratioA) return ratioB - ratioA;
      if (b.filledCount !== a.filledCount) return b.filledCount - a.filledCount;
      return b.summary.lastVisitedAt - a.summary.lastVisitedAt;
    }

    return b.summary.lastVisitedAt - a.summary.lastVisitedAt;
  });

  return sorted;
}

/**
 * Membagi daftar item menjadi halaman-halaman berukuran tetap (`6` per halaman secara default).
 */
export function paginateItems<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number = DASHBOARD_ROOMS_PAGE_SIZE
): PaginatedResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages);
  const startOffset = (page - 1) * safePageSize;
  const sliced = items.slice(startOffset, startOffset + safePageSize);

  return {
    items: sliced,
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex: totalItems === 0 ? 0 : startOffset + 1,
    endIndex: startOffset + sliced.length,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}
