"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarSync, Check, Clock, Eraser, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import {
  addMinutesToTime,
  buildTimeSlots,
  createSlotKey,
  DAY_LABEL_LONG,
  DAY_LABEL_SHORT,
  DAYS_OF_WEEK_ORDER,
  SLOT_INTERVAL_MIN,
} from "@/lib/engine/slots";
import {
  applyPaintBatch,
  applyPaintToSlot,
  areAvailabilityMapsEqual,
  countAvailabilityStats,
  pickSpatialNavigationTarget,
  resolveStrokeBrush,
  type SpatialCandidateRect,
  type SpatialDirection,
} from "@/lib/room/grid-interaction";
import type { AvailabilityMap, DayOfWeek, PaintBrushMode } from "@/types/schedule";

interface WeeklyRoutineEditorProps {
  savedRoutine: AvailabilityMap;
  onSaveRoutine: (nextRoutine: AvailabilityMap) => Promise<void>;
}

const DEFAULT_START_HOUR = 0;
const DEFAULT_END_HOUR = 24;

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.matches(':read-write, select, input[type="range"], [role="slider"]');
}

function keyToDirection(key: string): SpatialDirection | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

function buildPresetSlots(
  days: readonly DayOfWeek[],
  startHour: number,
  endHour: number
): string[] {
  const times = buildTimeSlots(startHour, endHour, SLOT_INTERVAL_MIN);
  const keys: string[] = [];
  for (const day of days) {
    for (const time of times) {
      keys.push(createSlotKey("days_of_week", day, time));
    }
  }
  return keys;
}

/**
 * Editor grid mingguan (Senin–Minggu) untuk menyimpan Jadwal Rutinku akun Google
 * agar bisa diterapkan 1-klik di room jadwal mana pun.
 */
export function WeeklyRoutineEditor({ savedRoutine, onSaveRoutine }: WeeklyRoutineEditorProps) {
  const { showToast } = useToast();
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<{
    active: boolean;
    brush: PaintBrushMode;
    visited: Set<string>;
  }>({
    active: false,
    brush: "free",
    visited: new Set(),
  });

  const [draftOverride, setDraftOverride] = useState<AvailabilityMap | null>(null);
  const [activeBrush, setActiveBrush] = useState<PaintBrushMode>("free");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [focusedSlotKey, setFocusedSlotKey] = useState<string | null>(null);

  const draftRoutine = draftOverride ?? savedRoutine;
  const timeSlots = useMemo(
    () => buildTimeSlots(DEFAULT_START_HOUR, DEFAULT_END_HOUR, SLOT_INTERVAL_MIN),
    []
  );
  const firstSlotKey = useMemo(
    () => createSlotKey("days_of_week", DAYS_OF_WEEK_ORDER[0], timeSlots[0]),
    [timeSlots]
  );
  const effectiveFocusKey = focusedSlotKey ?? firstSlotKey;

  const isDirty = useMemo(
    () => !areAvailabilityMapsEqual(draftRoutine, savedRoutine),
    [draftRoutine, savedRoutine]
  );
  const stats = useMemo(() => countAvailabilityStats(draftRoutine), [draftRoutine]);

  useEffect(() => {
    const endStroke = () => {
      strokeRef.current.active = false;
      strokeRef.current.visited.clear();
    };

    window.addEventListener("pointerup", endStroke);
    window.addEventListener("pointercancel", endStroke);
    return () => {
      window.removeEventListener("pointerup", endStroke);
      window.removeEventListener("pointercancel", endStroke);
    };
  }, []);

  const paintSlot = useCallback(
    (slotKey: string, brush: PaintBrushMode) => {
      setDraftOverride((prev) => applyPaintToSlot(prev ?? savedRoutine, slotKey, brush));
    },
    [savedRoutine]
  );

  const handleCellPointerDown = (
    slotKey: string,
    pointerEvent: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (pointerEvent.button !== 0 && pointerEvent.pointerType === "mouse") {
      return;
    }

    pointerEvent.preventDefault();
    const strokeBrush = resolveStrokeBrush(draftRoutine, slotKey, activeBrush);
    strokeRef.current = {
      active: true,
      brush: strokeBrush,
      visited: new Set([slotKey]),
    };
    setFocusedSlotKey(slotKey);
    paintSlot(slotKey, strokeBrush);
  };

  const handlePointerMove = (pointerEvent: React.PointerEvent<HTMLDivElement>) => {
    if (!strokeRef.current.active) return;
    const hit = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
    const cellButton =
      hit instanceof Element ? hit.closest<HTMLButtonElement>("[data-routine-slot]") : null;
    const slotKey = cellButton?.dataset.routineSlot;
    if (!slotKey || strokeRef.current.visited.has(slotKey)) return;

    strokeRef.current.visited.add(slotKey);
    paintSlot(slotKey, strokeRef.current.brush);
  };

  const handleGridKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (
      keyboardEvent.defaultPrevented ||
      keyboardEvent.altKey ||
      keyboardEvent.ctrlKey ||
      keyboardEvent.metaKey ||
      keyboardEvent.shiftKey
    ) {
      return;
    }

    const direction = keyToDirection(keyboardEvent.key);
    if (!direction) return;

    const pathTarget = keyboardEvent.nativeEvent.composedPath()[0] ?? keyboardEvent.target;
    if (isEditableElement(pathTarget)) return;

    const container = gridContainerRef.current;
    if (
      !container ||
      !(pathTarget instanceof HTMLButtonElement) ||
      !pathTarget.dataset.routineSlot
    ) {
      return;
    }

    const allButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("[data-routine-slot]")
    );
    const visibleCandidates: SpatialCandidateRect[] = [];
    for (const button of allButtons) {
      const id = button.dataset.routineSlot;
      if (!id) continue;
      const isVisible =
        typeof button.checkVisibility === "function" ? button.checkVisibility() : true;
      if (!isVisible) continue;
      visibleCandidates.push({
        id,
        rect: button.getBoundingClientRect(),
      });
    }

    const nextSlotKey = pickSpatialNavigationTarget(
      { id: pathTarget.dataset.routineSlot, rect: pathTarget.getBoundingClientRect() },
      visibleCandidates,
      direction
    );
    if (!nextSlotKey) return;

    keyboardEvent.preventDefault();
    const targetButton = allButtons.find((btn) => btn.dataset.routineSlot === nextSlotKey);
    if (targetButton) {
      setFocusedSlotKey(nextSlotKey);
      targetButton.focus();
      targetButton.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const applyWeekdayEvenings = () => {
    const keys = buildPresetSlots(["MON", "TUE", "WED", "THU", "FRI"], 19, 22);
    setDraftOverride((prev) => applyPaintBatch(prev ?? savedRoutine, keys, "free"));
  };

  const applyWeekendDaytime = () => {
    const keys = buildPresetSlots(["SAT", "SUN"], 10, 17);
    setDraftOverride((prev) => applyPaintBatch(prev ?? savedRoutine, keys, "free"));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRoutine(draftRoutine);
      setDraftOverride(null);
      showToast({
        title: "Jadwal Rutinku Tersimpan",
        message: "Kini bisa langsung kamu terapkan 1-klik di room mana pun.",
        variant: "success",
      });
    } catch {
      showToast({
        title: "Gagal Menyimpan",
        message: "Jadwal rutinmu belum tersimpan. Coba ulangi sebentar lagi.",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmReset = async () => {
    setIsSaving(true);
    try {
      await onSaveRoutine({});
      setDraftOverride(null);
      showToast({
        title: "Jadwal Rutin Dikosongkan",
        message: "Semua jam luang mingguanmu sudah dihapus.",
        variant: "danger",
      });
    } catch {
      showToast({
        title: "Gagal Mengosongkan",
        message: "Coba ulangi beberapa saat lagi.",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      id="jadwal-rutinku"
      aria-labelledby="routine-heading"
      className="wp-card grid gap-4 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
          >
            <CalendarSync className="h-5 w-5" />
          </span>
          <div className="grid gap-0.5">
            <h2
              id="routine-heading"
              className="text-lg font-extrabold text-text-primary sm:text-xl"
            >
              Jadwal Rutinku Mingguan
            </h2>
            <p className="text-xs text-text-secondary sm:text-sm">
              Tandai jam yang biasa luang tiap minggu, lalu pakai 1-klik saat masuk room baru.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-bold">
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-free-bg px-2.5 py-1 text-status-free-text">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{stats.freeCount} bisa</span>
          </span>
          {stats.tentativeCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-tentative-bg px-2.5 py-1 text-status-tentative-text">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{stats.tentativeCount} 50:50</span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Toolbar Kuas + Preset Cepat */}
      <div className="wp-card-muted flex flex-wrap items-center justify-between gap-3 p-3">
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="toolbar"
          aria-label="Kuas jadwal rutin"
        >
          <button
            type="button"
            aria-pressed={activeBrush === "free"}
            onClick={() => setActiveBrush("free")}
            className={`wp-btn !min-h-10 !px-3 !text-xs ${
              activeBrush === "free" ? "!bg-status-free !text-status-free-text" : "wp-btn-secondary"
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Bisa</span>
          </button>
          <button
            type="button"
            aria-pressed={activeBrush === "tentative"}
            onClick={() => setActiveBrush("tentative")}
            className={`wp-btn !min-h-10 !px-3 !text-xs ${
              activeBrush === "tentative"
                ? "wp-tentative-pattern !border-status-tentative-border !text-status-tentative-text"
                : "wp-btn-secondary"
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>50:50</span>
          </button>
          <button
            type="button"
            aria-pressed={activeBrush === "erase"}
            onClick={() => setActiveBrush("erase")}
            className={`wp-btn !min-h-10 !px-3 !text-xs ${
              activeBrush === "erase" ? "!bg-border-ink !text-white" : "wp-btn-secondary"
            }`}
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hapus</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={applyWeekdayEvenings}
            className="wp-btn wp-btn-soft !min-h-10 !px-3 !text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Malam Hari Kerja</span>
          </button>
          <button
            type="button"
            onClick={applyWeekendDaytime}
            className="wp-btn wp-btn-soft !min-h-10 !px-3 !text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Akhir Pekan</span>
          </button>
        </div>
      </div>

      {/* Grid Mingguan Penuh 24 Jam (Senin–Minggu, 00:00–24:00) */}
      <div
        role="region"
        tabIndex={0}
        aria-label="Grid editor jadwal rutin mingguan 24 jam"
        className="max-h-[34rem] overflow-auto rounded-xl border-2 border-border-ink bg-surface-canvas p-3"
      >
        <div
          ref={gridContainerRef}
          role="grid"
          aria-label="Jadwal rutin Senin sampai Minggu 24 jam"
          onKeyDown={handleGridKeyDown}
          onPointerMove={handlePointerMove}
          className="inline-flex min-w-full items-start gap-1.5"
        >
          {/* Safe Scroll Zone di Kolom Jam */}
          <div
            className="wp-safe-scroll-zone sticky left-0 z-20 grid shrink-0 gap-1 bg-surface-canvas pr-2"
            aria-hidden="true"
          >
            <div className="sticky top-0 z-30 flex h-10 items-center justify-end bg-surface-canvas pr-1 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted">
              Jam
            </div>

            {timeSlots.map((time) => {
              const isHourMark = time.endsWith(":00");
              return (
                <div
                  key={`rt-${time}`}
                  className={`flex h-9 items-center justify-end pr-1 font-mono text-xs ${
                    isHourMark ? "font-extrabold text-text-primary" : "font-medium text-text-muted"
                  }`}
                >
                  {isHourMark ? time : "·30"}
                </div>
              );
            })}
          </div>

          {/* Kolom Hari Senin..Minggu */}
          <div
            className="wp-paint-surface grid flex-1 gap-1.5"
            style={{
              gridTemplateColumns: "repeat(7, minmax(3.75rem, 1fr))",
            }}
          >
            {DAYS_OF_WEEK_ORDER.map((day) => (
              <div key={day} role="rowgroup" className="wp-grid-col grid gap-1">
                <div
                  role="columnheader"
                  className="sticky top-0 z-10 flex h-10 items-center justify-center rounded-lg border-2 border-border-ink bg-surface-muted px-1 font-mono text-xs font-extrabold text-text-primary"
                >
                  {DAY_LABEL_SHORT[day]}
                </div>

                {timeSlots.map((time) => {
                  const slotKey = createSlotKey("days_of_week", day, time);
                  const endTime = addMinutesToTime(time, SLOT_INTERVAL_MIN);
                  const status = draftRoutine[slotKey];
                  const isHalfHour = time.endsWith(":30");
                  const isFocusable = effectiveFocusKey === slotKey;
                  const statusLabel =
                    status === "free"
                      ? "Bisa"
                      : status === "tentative"
                        ? "Diusahakan 50:50"
                        : "Kosong";

                  return (
                    <div key={slotKey} role="row" className="contents">
                      <button
                        type="button"
                        role="gridcell"
                        tabIndex={isFocusable ? 0 : -1}
                        data-routine-slot={slotKey}
                        aria-selected={Boolean(status)}
                        aria-label={`${DAY_LABEL_LONG[day]} ${time} sampai ${endTime}, ${statusLabel}`}
                        onFocus={() => setFocusedSlotKey(slotKey)}
                        onPointerDown={(e) => handleCellPointerDown(slotKey, e)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            const brush = resolveStrokeBrush(draftRoutine, slotKey, activeBrush);
                            paintSlot(slotKey, brush);
                          }
                        }}
                        className={`grid h-9 w-full place-items-center rounded-lg border-2 transition-colors ${
                          status === "free"
                            ? "border-border-ink bg-status-free text-status-free-text"
                            : status === "tentative"
                              ? "wp-tentative-pattern border-status-tentative-border text-status-tentative-text"
                              : isHalfHour
                                ? "border-border-subtle/75 bg-surface-canvas/80 text-transparent hover:border-border-ink"
                                : "border-border-subtle bg-surface-card text-transparent hover:border-border-ink"
                        }`}
                      >
                        {status === "free" ? (
                          <Check className="h-3.5 w-3.5 stroke-[2.75]" aria-hidden="true" />
                        ) : status === "tentative" ? (
                          <Clock className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Simpan & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {stats.totalMarked > 0 ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setConfirmResetOpen(true)}
              className="wp-btn wp-btn-danger-soft !min-h-11"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Reset Rutinitas</span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="rounded-full border-2 border-status-tentative-border bg-status-tentative-bg px-3 py-1 text-xs font-bold text-status-tentative-text">
              Belum disimpan
            </span>
          ) : null}
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="wp-btn wp-btn-primary !min-h-11"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Simpan Jadwal Rutinku</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        eyebrow="Reset Jadwal Rutinku"
        title="Yakin kosongkan seluruh jadwal rutin mingguanmu?"
        description={
          <>
            Sebanyak <strong>{stats.totalMarked} slot rutin</strong> yang sudah kamu tandai akan
            dihapus dari profil akun Google kamu.
          </>
        }
        confirmLabel="Ya, Kosongkan Rutinitas"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={() => {
          void handleConfirmReset();
        }}
      />
    </section>
  );
}
