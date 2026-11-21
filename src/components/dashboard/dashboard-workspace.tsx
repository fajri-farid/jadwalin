"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  CalendarDays,
  CalendarPlus,
  CalendarSync,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  KeyRound,
  LayoutGrid,
  Lock,
  LogIn,
  RotateCcw,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { WeeklyRoutineEditor } from "@/components/dashboard/weekly-routine-editor";
import { useAuth } from "@/components/providers/auth-provider";
import { DropdownSelect, type DropdownOption } from "@/components/ui/dropdown-select";
import { useToast } from "@/components/ui/toast-provider";
import {
  DASHBOARD_ROOMS_PAGE_SIZE,
  filterAndSortDashboardRooms,
  paginateItems,
  prefilterDashboardSummaries,
  type DashboardRoleFilter,
  type DashboardRoomItem,
  type DashboardSortOption,
  type DashboardStatusFilter,
} from "@/lib/dashboard/room-filter";
import { computeBestTimeWindows } from "@/lib/engine/heatmap";
import { formatColumnLabel, formatTimeRange } from "@/lib/engine/slots";
import { formatHourOption } from "@/lib/forms/room-form";
import { getScheduleRepository } from "@/lib/repositories/schedule-repository";
import { countAvailabilityStats } from "@/lib/room/grid-interaction";
import {
  formatRoomDateSummary,
  getRoomEffectiveStatus,
  type RoomEffectiveStatus,
} from "@/lib/room/room-lifecycle";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type {
  AvailabilityMap,
  BestTimeWindow,
  ScheduleEvent,
  UserEventSummary,
} from "@/types/schedule";

interface LoadedUserProfileState {
  uid: string;
  summaries: UserEventSummary[];
  weeklyRoutine: AvailabilityMap;
}

interface EnrichedRoomRecord {
  event: ScheduleEvent | null;
  filledCount: number;
  totalMembers: number;
  topWindow: BestTimeWindow | null;
  effectiveStatus: RoomEffectiveStatus;
}

const DEFAULT_OPEN_STATUS: RoomEffectiveStatus = {
  state: "open",
  isClosed: false,
  isManualClosed: false,
  isAutoExpired: false,
  hasAgreedSlot: false,
};

const SORT_OPTIONS: readonly DropdownOption<DashboardSortOption>[] = [
  { value: "recent", label: "Terbaru", description: "Room terakhir dibuka atau dibuat" },
  { value: "title", label: "Judul A–Z", description: "Urutkan berdasarkan abjad judul" },
  { value: "progress", label: "Progres Terbanyak", description: "Yang paling banyak terisi dulu" },
] as const;

export function DashboardWorkspace() {
  const { user, isLoading, signIn } = useAuth();
  const { showToast } = useToast();
  const searchInputId = useId();

  const [profileState, setProfileState] = useState<LoadedUserProfileState | null>(null);
  const [enrichedByEventId, setEnrichedByEventId] = useState<Record<string, EnrichedRoomRecord>>(
    {}
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<DashboardRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<DashboardStatusFilter>("all");
  const [sortBy, setSortBy] = useState<DashboardSortOption>("recent");
  const [currentPage, setCurrentPage] = useState(1);

  const inFlightIdsRef = useRef<Set<string>>(new Set());

  // 1. Baca profil user (1 read Firestore -> recentEventSlugs + weeklyRoutine)
  useEffect(() => {
    let active = true;
    if (!user) return;

    const currentUid = user.uid;
    inFlightIdsRef.current.clear();

    void getScheduleRepository()
      .getUserProfile(currentUid)
      .then((profile) => {
        if (!active) return;
        setProfileState({
          uid: currentUid,
          summaries: profile?.recentEventSlugs ?? [],
          weeklyRoutine: profile?.weeklyRoutine ?? {},
        });
      })
      .catch(() => {
        if (!active) return;
        setProfileState({
          uid: currentUid,
          summaries: [],
          weeklyRoutine: {},
        });
      });

    return () => {
      active = false;
    };
  }, [user]);

  const activeProfile = user && profileState?.uid === user.uid ? profileState : null;
  const isFetchingProfile = Boolean(user && !activeProfile);
  const summaries = useMemo(() => activeProfile?.summaries ?? [], [activeProfile]);
  const weeklyRoutine = useMemo(() => activeProfile?.weeklyRoutine ?? {}, [activeProfile]);
  const routineStats = useMemo(() => countAvailabilityStats(weeklyRoutine), [weeklyRoutine]);

  // 2. Pra-filter ringan pada metadata ringkas (0 read tambahan)
  const needsFullHydration = statusFilter !== "all" || sortBy === "progress";

  const prefilteredSummaries = useMemo(
    () =>
      prefilterDashboardSummaries(summaries, {
        query: searchQuery,
        roleFilter,
        sortBy,
      }),
    [summaries, searchQuery, roleFilter, sortBy]
  );

  // Tentukan eventId mana saja yang perlu dimuat detailnya (maks 6 per halaman pada jalur normal)
  const targetEventIdsToLoad = useMemo(() => {
    if (needsFullHydration) {
      return prefilteredSummaries.map((item) => item.eventId);
    }
    const pageSlice = paginateItems(prefilteredSummaries, currentPage, DASHBOARD_ROOMS_PAGE_SIZE);
    return pageSlice.items.map((item) => item.eventId);
  }, [needsFullHydration, prefilteredSummaries, currentPage]);

  // 3. Lazy enrichment hemat kuota Firestore (hanya muat room yang belum ada di cache, maks 6 paralel per batch)
  useEffect(() => {
    if (!user || targetEventIdsToLoad.length === 0) return;

    const missingIds = targetEventIdsToLoad.filter(
      (id) => !(id in enrichedByEventId) && !inFlightIdsRef.current.has(id)
    );
    if (missingIds.length === 0) return;

    let active = true;
    const repo = getScheduleRepository();
    for (const id of missingIds) {
      inFlightIdsRef.current.add(id);
    }

    void (async () => {
      try {
        for (let i = 0; i < missingIds.length; i += DASHBOARD_ROOMS_PAGE_SIZE) {
          if (!active) break;
          const batchIds = missingIds.slice(i, i + DASHBOARD_ROOMS_PAGE_SIZE);

          const batchResults = await Promise.all(
            batchIds.map(async (eventId): Promise<[string, EnrichedRoomRecord]> => {
              try {
                const [event, participants] = await Promise.all([
                  repo.getEventById(eventId),
                  repo.listParticipants(eventId),
                ]);

                if (!event) {
                  return [
                    eventId,
                    {
                      event: null,
                      filledCount: 0,
                      totalMembers: 0,
                      topWindow: null,
                      effectiveStatus: DEFAULT_OPEN_STATUS,
                    },
                  ];
                }

                const { heatmap, bestWindows } = computeBestTimeWindows(event, participants, {
                  limit: 1,
                });
                const totalMembers = Math.max(heatmap.totalParticipantsCount, heatmap.filledCount);

                return [
                  eventId,
                  {
                    event,
                    filledCount: heatmap.filledCount,
                    totalMembers,
                    topWindow: bestWindows[0] ?? null,
                    effectiveStatus: getRoomEffectiveStatus(event),
                  },
                ];
              } catch {
                return [
                  eventId,
                  {
                    event: null,
                    filledCount: 0,
                    totalMembers: 0,
                    topWindow: null,
                    effectiveStatus: DEFAULT_OPEN_STATUS,
                  },
                ];
              }
            })
          );

          if (!active) break;
          setEnrichedByEventId((prev) => {
            const next = { ...prev };
            for (const [id, record] of batchResults) {
              next[id] = record;
            }
            return next;
          });
        }
      } finally {
        for (const id of missingIds) {
          inFlightIdsRef.current.delete(id);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user, targetEventIdsToLoad, enrichedByEventId]);

  const allCombinedItems = useMemo<DashboardRoomItem[]>(
    () =>
      summaries.map((summary) => {
        const cached = enrichedByEventId[summary.eventId];
        return {
          summary,
          event: cached?.event ?? null,
          filledCount: cached?.filledCount ?? 0,
          totalMembers: cached?.totalMembers ?? 0,
          topWindow: cached?.topWindow ?? null,
          effectiveStatus: cached?.effectiveStatus ?? DEFAULT_OPEN_STATUS,
        };
      }),
    [summaries, enrichedByEventId]
  );

  const filteredRooms = useMemo(
    () =>
      filterAndSortDashboardRooms(allCombinedItems, {
        query: searchQuery,
        roleFilter,
        statusFilter,
        sortBy,
      }),
    [allCombinedItems, searchQuery, roleFilter, statusFilter, sortBy]
  );

  const pagination = useMemo(
    () => paginateItems(filteredRooms, currentPage, DASHBOARD_ROOMS_PAGE_SIZE),
    [filteredRooms, currentPage]
  );

  const isHydratingCurrentView = useMemo(
    () => targetEventIdsToLoad.some((id) => !(id in enrichedByEventId)),
    [targetEventIdsToLoad, enrichedByEventId]
  );

  const hostCount = useMemo(
    () => summaries.filter((item) => item.role === "host").length,
    [summaries]
  );
  const participantCount = summaries.length - hostCount;

  const hasActiveFilters = Boolean(
    searchQuery.trim() || roleFilter !== "all" || statusFilter !== "all" || sortBy !== "recent"
  );

  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSortBy("recent");
    setCurrentPage(1);
  };

  const handleSignIn = async () => {
    const signedIn = await signIn();
    if (signedIn) {
      showToast({
        title: "Berhasil Masuk",
        message: `Selamat datang kembali, ${signedIn.displayName}.`,
        variant: "success",
      });
    }
  };

  const handleCopyCode = async (roomCode: string) => {
    try {
      await navigator.clipboard.writeText(roomCode);
      showToast({
        title: "Kode Disalin",
        message: `Kode ${formatRoomCodeDisplay(roomCode)} siap dibagikan ke grup.`,
        variant: "success",
      });
    } catch {
      showToast({
        title: "Kode Room",
        message: `Bagikan kode ${formatRoomCodeDisplay(roomCode)} ke temanmu.`,
        variant: "info",
      });
    }
  };

  const handleSaveRoutine = useCallback(
    async (nextRoutine: AvailabilityMap) => {
      if (!user) return;
      const updated = await getScheduleRepository().saveWeeklyRoutine(user.uid, nextRoutine);
      setProfileState((prev) => ({
        uid: user.uid,
        summaries: prev?.uid === user.uid ? prev.summaries : updated.recentEventSlugs,
        weeklyRoutine: updated.weeklyRoutine,
      }));
    },
    [user]
  );

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-8 sm:px-6">
        <div className="wp-card h-36 animate-pulse bg-surface-card p-6" />
        <div className="wp-card h-80 animate-pulse bg-surface-card p-6" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-5 px-4 py-10 sm:px-6">
        <section className="wp-card grid gap-4 p-6 text-center">
          <span
            aria-hidden="true"
            className="mx-auto grid h-12 w-12 place-items-center rounded-xl border-2 border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
          >
            <LayoutGrid className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-extrabold text-text-primary">
            Masuk untuk Kelola Room &amp; Jadwal Rutinku
          </h1>
          <p className="mx-auto text-sm text-text-secondary">
            Masuk dengan Google untuk membuat room, melihat riwayat room kelompok, dan menyimpan
            template jadwal rutin mingguanmu.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button type="button" onClick={handleSignIn} className="wp-btn wp-btn-primary">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Masuk dengan Google</span>
            </button>
            <Link href="/gabung" className="wp-btn wp-btn-secondary">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Gabung Pakai Kode</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const pageNumbers = Array.from({ length: pagination.totalPages }, (_, idx) => idx + 1);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Header Profil & Aksi Cepat */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            Halo, {user.displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold text-text-secondary">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-card px-3 py-1">
              <LayoutGrid className="h-3.5 w-3.5 text-brand-hover" aria-hidden="true" />
              <span>{summaries.length} room</span>
            </span>
            <a
              href="#jadwal-rutinku"
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-status-free-bg px-3 py-1 text-status-free-text transition-colors hover:bg-emerald-100"
            >
              <CalendarSync className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{routineStats.totalMarked} slot rutin</span>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/buat" className="wp-btn wp-btn-primary">
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            <span>Buat Room</span>
          </Link>
          <Link href="/gabung" className="wp-btn wp-btn-secondary">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Gabung Kode</span>
          </Link>
        </div>
      </div>

      {/* Seksi 1: Riwayat Room dengan Search, Filter, Custom Dropdown & Pagination 6/Hal */}
      <section aria-labelledby="recent-rooms-heading" className="wp-card grid gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
            >
              <LayoutGrid className="h-5 w-5" />
            </span>
            <div className="grid gap-0.5">
              <h2 id="recent-rooms-heading" className="text-lg font-extrabold text-text-primary">
                Daftar Room Kamu
              </h2>
              <span className="text-xs font-medium text-text-muted">
                {pagination.totalItems > 0
                  ? `Menampilkan ${pagination.startIndex}–${pagination.endIndex} dari ${pagination.totalItems} room`
                  : `${summaries.length} room tersimpan di akun ini`}
              </span>
            </div>
          </div>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          ) : null}
        </div>

        {/* Bar Search (Judul / Kode) + Custom Dropdown Urut + Filter Status & Peran */}
        {summaries.length > 0 ? (
          <div className="wp-card-muted grid gap-3 p-3.5">
            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3.5 h-4 w-4 text-text-muted"
                  aria-hidden="true"
                />
                <label htmlFor={searchInputId} className="visually-hidden">
                  Cari berdasarkan judul room atau kode 6 digit
                </label>
                <input
                  id={searchInputId}
                  type="search"
                  placeholder="Cari judul room atau kode 6 digit (mis. 332 767)..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="wp-input !pl-10 !pr-10 text-sm"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    aria-label="Hapus kata pencarian"
                    className="absolute right-2 grid h-8 w-8 place-items-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text-primary"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-text-secondary">
                  <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Urut:</span>
                </span>
                <DropdownSelect
                  value={sortBy}
                  options={SORT_OPTIONS}
                  onChange={(nextSort) => {
                    setSortBy(nextSort);
                    setCurrentPage(1);
                  }}
                  ariaLabel="Urutkan daftar room"
                  className="w-full sm:w-44"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="group"
                aria-label="Filter status room"
                className="inline-flex flex-wrap gap-1 rounded-xl border-2 border-border-ink bg-surface-card p-1"
              >
                <button
                  type="button"
                  aria-pressed={statusFilter === "all"}
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    statusFilter === "all"
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "open"}
                  onClick={() => {
                    setStatusFilter("open");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    statusFilter === "open"
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Aktif
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "closed"}
                  onClick={() => {
                    setStatusFilter("closed");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    statusFilter === "closed"
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Selesai
                </button>
              </div>

              <div
                role="group"
                aria-label="Filter peran room"
                className="inline-flex flex-wrap gap-1 rounded-xl border-2 border-border-ink bg-surface-card p-1"
              >
                <button
                  type="button"
                  aria-pressed={roleFilter === "all"}
                  onClick={() => {
                    setRoleFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    roleFilter === "all"
                      ? "bg-border-ink text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Semua Peran
                </button>
                <button
                  type="button"
                  aria-pressed={roleFilter === "host"}
                  onClick={() => {
                    setRoleFilter("host");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    roleFilter === "host"
                      ? "bg-border-ink text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Pembuat ({hostCount})
                </button>
                <button
                  type="button"
                  aria-pressed={roleFilter === "participant"}
                  onClick={() => {
                    setRoleFilter("participant");
                    setCurrentPage(1);
                  }}
                  className={`min-h-9 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                    roleFilter === "participant"
                      ? "bg-border-ink text-white"
                      : "text-text-secondary hover:bg-surface-muted"
                  }`}
                >
                  Anggota ({participantCount})
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Grid Kartu Room (maks 6 kartu per halaman) */}
        {isFetchingProfile || (needsFullHydration && isHydratingCurrentView) ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-48 animate-pulse rounded-2xl border-2 border-border-subtle bg-surface-muted" />
            <div className="h-48 animate-pulse rounded-2xl border-2 border-border-subtle bg-surface-muted" />
          </div>
        ) : pagination.items.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2">
              {pagination.items.map((item) => {
                const { summary, event, filledCount, totalMembers, topWindow, effectiveStatus } =
                  item;
                const isCardLoading = !(summary.eventId in enrichedByEventId);
                const title = event?.title ?? summary.title;
                const roomCode = event?.roomCode ?? summary.roomCode;
                const description = event?.description?.trim() ?? "";
                const progressPct =
                  totalMembers > 0 ? Math.round((filledCount / totalMembers) * 100) : 0;

                return (
                  <li
                    key={summary.eventId}
                    className="flex flex-col justify-between gap-3.5 rounded-2xl border-2 border-border-ink bg-surface-canvas p-4 shadow-[4px_4px_0_var(--border-ink)] transition-transform hover:-translate-y-0.5"
                  >
                    <div className="grid gap-2.5">
                      {/* Baris Badge Status & Peran */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isCardLoading ? (
                            <span className="h-5 w-14 animate-pulse rounded-full bg-surface-muted" />
                          ) : effectiveStatus.state === "open" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-status-free-border bg-status-free-bg px-2.5 py-0.5 text-[11px] font-bold text-status-free-text">
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-status-free"
                                aria-hidden="true"
                              />
                              <span>Aktif</span>
                            </span>
                          ) : effectiveStatus.hasAgreedSlot ? (
                            <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-free px-2.5 py-0.5 text-[11px] font-extrabold text-status-free-text">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              <span>Jadwal Fix</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border-ink bg-surface-muted px-2.5 py-0.5 text-[11px] font-bold text-text-secondary">
                              <Lock className="h-3 w-3" aria-hidden="true" />
                              <span>{effectiveStatus.isAutoExpired ? "Selesai" : "Ditutup"}</span>
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center gap-1 rounded-full border border-border-ink px-2 py-0.5 text-[11px] font-bold ${
                              summary.role === "host"
                                ? "bg-brand-soft text-brand-hover"
                                : "bg-surface-card text-text-secondary"
                            }`}
                          >
                            {summary.role === "host" ? (
                              <Crown className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Users className="h-3 w-3" aria-hidden="true" />
                            )}
                            <span>{summary.role === "host" ? "Pembuat" : "Anggota"}</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyCode(roomCode)}
                          aria-label={`Salin kode room ${roomCode}`}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border-2 border-border-ink bg-brand-soft px-2.5 py-0.5 font-mono text-xs font-extrabold text-brand-hover transition-colors hover:bg-indigo-100"
                        >
                          <span>{formatRoomCodeDisplay(roomCode)}</span>
                          <Copy className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>

                      {/* Judul & Deskripsi Room */}
                      <div className="grid gap-1">
                        <Link
                          href={`/r/${summary.slug}`}
                          className="text-lg font-extrabold leading-snug text-text-primary underline-offset-4 hover:text-brand-hover hover:underline"
                        >
                          {title}
                        </Link>
                        {isCardLoading ? (
                          <span className="h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
                        ) : description ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">
                            {description}
                          </p>
                        ) : (
                          <p className="text-xs italic text-text-muted">Tanpa deskripsi singkat</p>
                        )}
                      </div>

                      {/* Cuplikan Tanggal & Jam */}
                      {event ? (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-text-secondary">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card px-2 py-0.5">
                            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>{formatRoomDateSummary(event)}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card px-2 py-0.5 font-mono">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            <span>
                              {formatHourOption(event.startHour)}–{formatHourOption(event.endHour)}
                            </span>
                          </span>
                        </div>
                      ) : null}

                      {/* Highlight Jadwal Fix / Waktu Terbaik #1 */}
                      {event?.agreedSlot && effectiveStatus.isManualClosed ? (
                        <div className="flex items-center gap-2 rounded-xl border-2 border-border-ink bg-status-free-bg px-3 py-2 text-xs font-bold text-status-free-text">
                          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate font-mono">
                            Fix:{" "}
                            {formatColumnLabel(event.dateMode, event.agreedSlot.columnKey, "short")}{" "}
                            ·{" "}
                            {formatTimeRange(event.agreedSlot.startTime, event.agreedSlot.endTime)}
                          </span>
                        </div>
                      ) : topWindow && event ? (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-status-free-border bg-status-free-bg/70 px-3 py-1.5 text-xs font-bold text-status-free-text">
                          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate font-mono">
                              {formatColumnLabel(event.dateMode, topWindow.columnKey, "short")} ·{" "}
                              {formatTimeRange(topWindow.startTime, topWindow.endTime)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[11px]">
                            {topWindow.freeCount}/{Math.max(totalMembers, 1)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Footer Progres Anggota & Tombol Buka */}
                    <div className="grid gap-2.5 border-t border-border-subtle pt-3">
                      {totalMembers > 0 ? (
                        <div className="grid gap-1">
                          <div className="flex items-center justify-between font-mono text-[11px] font-bold text-text-secondary">
                            <span>Respon anggota</span>
                            <span>
                              {filledCount}/{totalMembers} sudah isi
                            </span>
                          </div>
                          <div
                            className="h-2 w-full overflow-hidden rounded-full border border-border-ink bg-surface-card"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full bg-status-free transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <Link
                        href={`/r/${summary.slug}`}
                        className="wp-btn wp-btn-secondary w-full justify-between !min-h-10 !text-xs"
                      >
                        <span>{effectiveStatus.isClosed ? "Lihat Arsip Hasil" : "Buka Room"}</span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Kontrol Pagination (6 room per halaman) */}
            {pagination.totalPages > 1 ? (
              <nav
                aria-label="Navigasi halaman daftar room"
                className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-border-subtle pt-4"
              >
                <span className="font-mono text-xs font-bold text-text-muted">
                  Halaman {pagination.page} dari {pagination.totalPages} (
                  {DASHBOARD_ROOMS_PAGE_SIZE} per halaman)
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!pagination.hasPrev}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Sebelumnya</span>
                  </button>

                  {pageNumbers.map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      aria-current={pageNum === pagination.page ? "page" : undefined}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`wp-btn !min-h-10 !min-w-10 !px-2.5 font-mono !text-xs ${
                        pageNum === pagination.page ? "wp-btn-primary" : "wp-btn-secondary"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={!pagination.hasNext}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))
                    }
                    className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        ) : summaries.length > 0 ? (
          <div className="wp-card-muted grid gap-3 p-6 text-center">
            <p className="text-sm font-bold text-text-primary">
              Tidak ada room yang cocok dengan pencarianmu
            </p>
            <p className="text-xs text-text-secondary">
              Coba kata kunci judul lain, periksa 6 digit kodenya, atau reset filter status/peran.
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={resetFilters}
                className="wp-btn wp-btn-secondary !min-h-10 !text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tampilkan Semua Room</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="wp-card-muted grid gap-3 p-6 text-center">
            <p className="text-sm font-bold text-text-primary">Belum ada room tersimpan</p>
            <p className="text-xs text-text-secondary">
              Room yang kamu buat atau ikuti saat login Google akan otomatis muncul di sini.
            </p>
            <div className="flex justify-center">
              <Link href="/buat" className="wp-btn wp-btn-primary !min-h-10 !text-xs">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                <span>Buat Room Pertama</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Seksi 2: Editor Jadwal Rutinku Mingguan */}
      <WeeklyRoutineEditor savedRoutine={weeklyRoutine} onSaveRoutine={handleSaveRoutine} />
    </div>
  );
}
