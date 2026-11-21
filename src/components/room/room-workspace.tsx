"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, KeyRound, LayoutGrid, Paintbrush } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { AvailabilityGrid, type GridViewMode } from "@/components/room/availability-grid";
import { BestTimesPanel } from "@/components/room/best-times-panel";
import {
  IdentityPickerModal,
  type IdentitySelectionPayload,
} from "@/components/room/identity-picker-modal";
import { RoomHeaderBar } from "@/components/room/room-header-bar";
import { SetPinDialog } from "@/components/room/set-pin-dialog";
import { SlotDetailDialog } from "@/components/room/slot-detail-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import { computeBestTimeWindows } from "@/lib/engine/heatmap";
import { applyWeeklyRoutineToEvent } from "@/lib/engine/routine";
import { RepositoryError, getScheduleRepository } from "@/lib/repositories/schedule-repository";
import {
  areAvailabilityMapsEqual,
  computeTeammateSlotHints,
  countAvailabilityStats,
  resolveAutoSessionParticipant,
} from "@/lib/room/grid-interaction";
import { clearRoomSession, getRoomSession, saveRoomSession } from "@/lib/storage/room-sessions";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type {
  AvailabilityMap,
  BestTimeWindow,
  PaintBrushMode,
  Participant,
  ScheduleEvent,
  SlotHeatmapCell,
} from "@/types/schedule";

interface RoomWorkspaceProps {
  slug: string;
}

export function RoomWorkspace({ slug }: RoomWorkspaceProps) {
  const { user, isLoading: authLoading, signIn } = useAuth();
  const { showToast } = useToast();

  const [event, setEvent] = useState<ScheduleEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);

  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [trustedParticipantId, setTrustedParticipantId] = useState<string | null>(null);
  const [verifiedPins, setVerifiedPins] = useState<Record<string, string>>({});

  const [draftAvailabilities, setDraftAvailabilities] = useState<AvailabilityMap>({});
  const [viewMode, setViewMode] = useState<GridViewMode>("fill");
  const [activeBrush, setActiveBrush] = useState<PaintBrushMode>("free");
  const [isSaving, setIsSaving] = useState(false);

  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [setPinOpen, setSetPinOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [inspectedCell, setInspectedCell] = useState<SlotHeatmapCell | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  const [weeklyRoutine, setWeeklyRoutine] = useState<AvailabilityMap>({});

  const autoResolvedEventRef = useRef<string | null>(null);

  // 1. Muat metadata room berdasarkan slug
  useEffect(() => {
    let active = true;
    const repo = getScheduleRepository();
    autoResolvedEventRef.current = null;

    void (async () => {
      try {
        const foundEvent = await repo.getEventBySlug(slug);
        if (!active) return;
        setEvent(foundEvent);
        if (!foundEvent) {
          setParticipants([]);
          setHasLoadedParticipants(true);
        }
      } catch {
        if (active) {
          setEvent(null);
          setHasLoadedParticipants(true);
        }
      } finally {
        if (active) setIsLoadingEvent(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  // 2. Berlangganan subkoleksi participants secara real-time (onSnapshot + cleanup wajib)
  useEffect(() => {
    if (!event) return;

    const repo = getScheduleRepository();
    const unsubscribe = repo.subscribeEventParticipants(
      event.id,
      (nextList) => {
        setParticipants(nextList);
        setHasLoadedParticipants(true);
      },
      () => {
        setHasLoadedParticipants(true);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [event]);

  // 3. Muat template Jadwal Rutinku bagi akun Google yang sedang login
  useEffect(() => {
    if (!user) return;

    let active = true;
    const repo = getScheduleRepository();
    void repo
      .getUserProfile(user.uid)
      .then((profile) => {
        if (!active) return;
        setWeeklyRoutine(profile?.weeklyRoutine ?? {});
      })
      .catch(() => {
        if (active) setWeeklyRoutine({});
      });

    return () => {
      active = false;
    };
  }, [user]);

  const effectiveRoutine = useMemo(() => (user ? weeklyRoutine : {}), [user, weeklyRoutine]);
  const hasRoutineTemplate = Object.keys(effectiveRoutine).length > 0;

  // 4. Auto-recognize sesi perangkat / akun Google saat pertama kali room terbuka
  useEffect(() => {
    if (!event || !hasLoadedParticipants || authLoading) return;
    if (autoResolvedEventRef.current === event.id) return;

    autoResolvedEventRef.current = event.id;
    const savedSession = getRoomSession(event.id);
    const resolved = resolveAutoSessionParticipant({
      participants,
      authUser: user,
      savedSession,
    });

    queueMicrotask(() => {
      if (resolved) {
        setActiveParticipantId(resolved.participant.id);
        setTrustedParticipantId(resolved.trustedDevice ? resolved.participant.id : null);
        setDraftAvailabilities({ ...resolved.participant.availabilities });
      } else {
        if (savedSession) {
          clearRoomSession(event.id);
        }
        setIdentityModalOpen(true);
      }
    });
  }, [event, hasLoadedParticipants, authLoading, participants, user]);

  const activeParticipant = useMemo(
    () => participants.find((item) => item.id === activeParticipantId) ?? null,
    [participants, activeParticipantId]
  );

  const { heatmap, bestWindows } = useMemo(() => {
    if (!event) {
      return {
        heatmap: {
          cellsBySlotKey: {},
          columns: [],
          timeSlots: [],
          filledParticipantIds: [],
          filledParticipantNames: [],
          pendingParticipantIds: [],
          pendingParticipantNames: [],
          filledCount: 0,
          pendingCount: 0,
          totalParticipantsCount: 0,
        },
        bestWindows: [] as BestTimeWindow[],
      };
    }
    return computeBestTimeWindows(event, participants, { limit: 5 });
  }, [event, participants]);

  const highlightedSlotKeys = useMemo(() => {
    if (!selectedWindowId) return new Set<string>();
    const found = bestWindows.find((win) => win.id === selectedWindowId);
    return new Set(found?.slotKeys ?? []);
  }, [bestWindows, selectedWindowId]);

  const isDirty = useMemo(() => {
    if (!activeParticipant) return false;
    return !areAvailabilityMapsEqual(draftAvailabilities, activeParticipant.availabilities);
  }, [activeParticipant, draftAvailabilities]);

  const draftStats = useMemo(
    () => countAvailabilityStats(draftAvailabilities),
    [draftAvailabilities]
  );

  const teammateHints = useMemo(
    () => computeTeammateSlotHints(participants, activeParticipantId),
    [participants, activeParticipantId]
  );

  const applySelectedIdentity = useCallback(
    (payload: IdentitySelectionPayload) => {
      if (!event) return;
      const { participant, verifiedPin, trustedDevice } = payload;

      setActiveParticipantId(participant.id);
      setDraftAvailabilities({ ...participant.availabilities });
      setViewMode("fill");

      if (verifiedPin) {
        setVerifiedPins((prev) => ({ ...prev, [participant.id]: verifiedPin }));
      }
      if (trustedDevice) {
        saveRoomSession(event.id, {
          participantId: participant.id,
          participantName: participant.name,
        });
        setTrustedParticipantId(participant.id);
      }

      if (user) {
        void getScheduleRepository()
          .recordUserEventVisit(user.uid, {
            eventId: event.id,
            slug: event.slug,
            roomCode: event.roomCode,
            title: event.title,
            role: event.hostUid === user.uid ? "host" : "participant",
            lastVisitedAt: Date.now(),
          })
          .catch(() => {
            // Riwayat kunjungan bersifat non-blocking
          });
      }
    },
    [event, user]
  );

  const handleClaimRoster = useCallback(
    async (input: {
      participant: Participant;
      pin?: string;
      googleUid?: string | null;
      trustedDevice?: boolean;
    }): Promise<IdentitySelectionPayload> => {
      if (!event) {
        throw new Error("Room tidak ditemukan.");
      }

      const repo = getScheduleRepository();
      const claimed = await repo.claimOrCreateParticipant({
        eventId: event.id,
        participantId: input.participant.id,
        pin: input.pin,
        googleUid: input.googleUid,
        trustedDevice: input.trustedDevice,
      });

      const payload: IdentitySelectionPayload = {
        participant: claimed,
        verifiedPin: input.pin,
        trustedDevice: true,
      };
      applySelectedIdentity(payload);
      showToast({
        title: `Halo, ${claimed.name}!`,
        message: "Sekarang kamu bisa langsung menandai jam luangmu.",
        variant: "info",
      });
      return payload;
    },
    [event, applySelectedIdentity, showToast]
  );

  const handleCreateWalkIn = useCallback(
    async (input: {
      name: string;
      newPin?: string;
      googleUid?: string | null;
    }): Promise<IdentitySelectionPayload> => {
      if (!event) {
        throw new Error("Room tidak ditemukan.");
      }

      const repo = getScheduleRepository();
      const created = await repo.claimOrCreateParticipant({
        eventId: event.id,
        name: input.name,
        newPin: input.newPin,
        googleUid: input.googleUid,
      });

      const payload: IdentitySelectionPayload = {
        participant: created,
        verifiedPin: input.newPin,
        trustedDevice: true,
      };
      applySelectedIdentity(payload);
      showToast({
        title: `Selamat datang, ${created.name}!`,
        message: input.newPin
          ? "Namamu masuk daftar dengan perlindungan PIN 4 angka."
          : "Silakan tandai jam luangmu lalu klik Simpan.",
        variant: "success",
      });
      return payload;
    },
    [event, applySelectedIdentity, showToast]
  );

  const handleSaveAvailability = async () => {
    if (!event || !activeParticipant) {
      setIdentityModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const repo = getScheduleRepository();
      const updated = await repo.updateParticipantAvailability({
        eventId: event.id,
        participantId: activeParticipant.id,
        availabilities: draftAvailabilities,
        googleUid: activeParticipant.googleUid ? user?.uid : undefined,
        pin: verifiedPins[activeParticipant.id],
        trustedDevice: trustedParticipantId === activeParticipant.id,
      });

      setDraftAvailabilities({ ...updated.availabilities });
      saveRoomSession(event.id, {
        participantId: updated.id,
        participantName: updated.name,
      });
      setTrustedParticipantId(updated.id);

      if (user) {
        void repo
          .recordUserEventVisit(user.uid, {
            eventId: event.id,
            slug: event.slug,
            roomCode: event.roomCode,
            title: event.title,
            role: event.hostUid === user.uid ? "host" : "participant",
            lastVisitedAt: Date.now(),
          })
          .catch(() => {
            // Non-blocking
          });
      }

      showToast({
        title: "Jadwal Tersimpan",
        message: "Pilihan waktumu sudah terbarui untuk semua anggota.",
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof RepositoryError
          ? err.message
          : "Jadwal belum berhasil disimpan. Coba ulangi sebentar lagi.";
      showToast({
        title: "Gagal Menyimpan",
        message,
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNewPin = async (newPin: string) => {
    if (!event || !activeParticipant) return;

    const repo = getScheduleRepository();
    const updated = await repo.updateParticipantAvailability({
      eventId: event.id,
      participantId: activeParticipant.id,
      availabilities: draftAvailabilities,
      newPin,
      trustedDevice: true,
    });

    setVerifiedPins((prev) => ({ ...prev, [updated.id]: newPin }));
    setDraftAvailabilities({ ...updated.availabilities });
    saveRoomSession(event.id, {
      participantId: updated.id,
      participantName: updated.name,
    });
    setTrustedParticipantId(updated.id);

    showToast({
      title: "PIN Aktif",
      message: `Jadwal ${updated.name} kini terkunci dengan PIN 4 angka.`,
      variant: "success",
    });
  };

  const handleApplyWeeklyRoutine = () => {
    if (!event || !hasRoutineTemplate) return;
    const result = applyWeeklyRoutineToEvent(effectiveRoutine, event, {
      existingAvailabilities: draftAvailabilities,
      mode: "merge",
    });

    setDraftAvailabilities(result.availabilities);
    showToast({
      title: result.appliedCount > 0 ? "Jadwal Rutinku Diterapkan" : "Belum Ada Jam yang Cocok",
      message:
        result.appliedCount > 0
          ? `${result.appliedCount} slot terisi otomatis. Jangan lupa klik Simpan.`
          : "Rentang hari atau jam room ini di luar jadwal rutinmu.",
      variant: result.appliedCount > 0 ? "success" : "info",
    });
  };

  const handleCopyCode = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(event.roomCode);
      showToast({
        title: "Kode Disalin",
        message: `Kode ${formatRoomCodeDisplay(event.roomCode)} siap dikirim ke grup.`,
        variant: "success",
      });
    } catch {
      showToast({
        title: "Kode Room",
        message: `Bagikan kode ${formatRoomCodeDisplay(event.roomCode)} ke temanmu.`,
        variant: "info",
      });
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast({
        title: "Link Room Disalin",
        message: "Tinggal tempel di grup WhatsApp untuk undang temanmu.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Salin Link",
        message: "Salin alamat halaman dari bilah browser kamu.",
        variant: "info",
      });
    }
  };

  const handleSelectBestWindow = (win: BestTimeWindow) => {
    setSelectedWindowId((prev) => (prev === win.id ? null : win.id));
    setViewMode("heatmap");
  };

  if (isLoadingEvent) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8 sm:px-6">
        <div className="wp-card h-44 animate-pulse bg-surface-card p-6" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="wp-card h-96 animate-pulse bg-surface-card p-6" />
          <div className="wp-card h-64 animate-pulse bg-surface-card p-6" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto grid w-full max-w-xl gap-5 px-4 py-10 sm:px-6">
        <section className="wp-card grid gap-4 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border-2 border-border-ink bg-status-tentative-bg text-status-tentative-text">
            <KeyRound className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary">Room Tidak Ditemukan</h1>
          <p className="mx-auto text-sm text-text-secondary">
            Periksa kembali link undangan atau masukkan ulang 6 angka kode room dari temanmu.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/gabung" className="wp-btn wp-btn-primary">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Masukkan Kode 6 Digit</span>
            </Link>
            <Link href="/buat" className="wp-btn wp-btn-secondary">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Buat Room Baru</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 sm:py-7 ${
        viewMode === "fill" ? "pb-32 sm:pb-24" : "pb-10"
      }`}
    >
      <RoomHeaderBar
        event={event}
        participants={participants}
        filledCount={heatmap.filledCount}
        activeParticipant={activeParticipant}
        onCopyCode={handleCopyCode}
        onCopyLink={handleCopyLink}
        onOpenIdentityPicker={() => setIdentityModalOpen(true)}
        onOpenSetPin={() => setSetPinOpen(true)}
      />

      {/* Tab Switcher: Isi Jadwalku vs Hasil Grup (Heatmap) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Tampilan jadwal room"
          className="inline-flex gap-1.5 rounded-xl border-2 border-border-ink bg-surface-card p-1 shadow-[3px_3px_0_var(--border-ink)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "fill"}
            onClick={() => setViewMode("fill")}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors ${
              viewMode === "fill"
                ? "bg-brand text-white"
                : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            }`}
          >
            <Paintbrush className="h-4 w-4" aria-hidden="true" />
            <span>Isi Jadwalku</span>
            {activeParticipant && draftStats.totalMarked > 0 ? (
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-xs font-extrabold ${
                  viewMode === "fill"
                    ? "bg-white/20 text-white"
                    : "bg-status-free-bg text-status-free-text"
                }`}
              >
                {draftStats.totalMarked}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "heatmap"}
            onClick={() => setViewMode("heatmap")}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold transition-colors ${
              viewMode === "heatmap"
                ? "bg-brand text-white"
                : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            }`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span>Hasil Grup</span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-xs font-extrabold ${
                viewMode === "heatmap"
                  ? "bg-white/20 text-white"
                  : "bg-surface-muted text-text-secondary"
              }`}
            >
              {heatmap.filledCount}
            </span>
          </button>
        </div>

        {activeParticipant && isDirty ? (
          <span className="inline-flex items-center rounded-full border-2 border-status-tentative-border bg-status-tentative-bg px-3 py-1 text-xs font-bold text-status-tentative-text">
            Perubahan belum disimpan
          </span>
        ) : null}
      </div>

      {/* Layout 1 Kolom Mobile -> 2 Kolom Desktop (Grid + Top Rekomendasi) */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <AvailabilityGrid
          event={event}
          mode={viewMode}
          heatmap={heatmap}
          teammateHints={teammateHints}
          draftAvailabilities={draftAvailabilities}
          activeBrush={activeBrush}
          highlightedSlotKeys={highlightedSlotKeys}
          canEdit={Boolean(activeParticipant)}
          isDirty={isDirty}
          isSaving={isSaving}
          hasRoutineTemplate={hasRoutineTemplate}
          onChangeBrush={setActiveBrush}
          onChangeDraft={setDraftAvailabilities}
          onRequestSave={handleSaveAvailability}
          onRequestClearAll={() => setConfirmClearOpen(true)}
          onRequestApplyRoutine={handleApplyWeeklyRoutine}
          onRequestIdentity={() => setIdentityModalOpen(true)}
          onInspectHeatmapCell={(cell) => setInspectedCell(cell)}
        />

        <aside className="lg:sticky lg:top-20">
          <BestTimesPanel
            dateMode={event.dateMode}
            bestWindows={bestWindows}
            filledCount={heatmap.filledCount}
            totalParticipantsCount={heatmap.totalParticipantsCount}
            selectedWindowId={selectedWindowId}
            onSelectWindow={handleSelectBestWindow}
          />
        </aside>
      </div>

      {/* Modal Pemilih Identitas Roster / Tambah Nama / Google */}
      <IdentityPickerModal
        open={identityModalOpen}
        onOpenChange={setIdentityModalOpen}
        roomTitle={event.title}
        participants={participants}
        activeParticipantId={activeParticipantId}
        trustedParticipantId={trustedParticipantId}
        authUser={user}
        onSignInGoogle={signIn}
        onClaimRoster={handleClaimRoster}
        onCreateWalkIn={handleCreateWalkIn}
      />

      {/* Dialog Pasang PIN Opsional */}
      {activeParticipant ? (
        <SetPinDialog
          open={setPinOpen}
          onOpenChange={setSetPinOpen}
          participantName={activeParticipant.name}
          onSavePin={handleSaveNewPin}
        />
      ) : null}

      {/* Dialog Rincian Peserta per Slot Heatmap */}
      <SlotDetailDialog
        cell={inspectedCell}
        dateMode={event.dateMode}
        filledCount={heatmap.filledCount}
        totalParticipantsCount={heatmap.totalParticipantsCount}
        pendingNames={heatmap.pendingParticipantNames}
        onClose={() => setInspectedCell(null)}
      />

      {/* Dialog Konfirmasi Kosongkan Slot */}
      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        eyebrow="Kosongkan Jadwal"
        title="Yakin hapus semua pilihan waktumu di room ini?"
        description={
          <>
            Sebanyak <strong>{draftStats.totalMarked} slot waktu</strong> milik{" "}
            <strong>{activeParticipant?.name ?? "kamu"}</strong> akan dikosongkan. Klik{" "}
            <strong>Simpan Jadwal</strong> setelahnya jika ingin memperbarui ke grup.
          </>
        }
        confirmLabel="Ya, Kosongkan Slot"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={() => {
          setDraftAvailabilities({});
          showToast({
            title: "Slot Dikosongkan",
            message: "Semua tanda waktumu di layar sudah dibersihkan.",
            variant: "danger",
          });
        }}
      />
    </div>
  );
}
