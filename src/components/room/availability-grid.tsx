"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUpDown,
  CalendarSync,
  Check,
  Clock,
  Eraser,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import {
  addMinutesToTime,
  createSlotKey,
  formatColumnLabel,
  parseSlotKey,
  SLOT_INTERVAL_MIN,
} from "@/lib/engine/slots";
import {
  applyPaintToSlot,
  computeDisplayHeatLevel,
  pickSpatialNavigationTarget,
  resolveStrokeBrush,
  type SpatialCandidateRect,
  type SpatialDirection,
  type TeammateHintsSummary,
} from "@/lib/room/grid-interaction";
import type {
  AvailabilityMap,
  HeatmapSummary,
  PaintBrushMode,
  ScheduleEvent,
  SlotHeatmapCell,
} from "@/types/schedule";

export type GridViewMode = "fill" | "heatmap";

interface AvailabilityGridProps {
  event: ScheduleEvent;
  mode: GridViewMode;
  heatmap: HeatmapSummary;
  teammateHints: TeammateHintsSummary;
  draftAvailabilities: AvailabilityMap;
  activeBrush: PaintBrushMode;
  highlightedSlotKeys: ReadonlySet<string>;
  canEdit: boolean;
  isDirty: boolean;
  isSaving: boolean;
  hasRoutineTemplate: boolean;
  onChangeBrush: (brush: PaintBrushMode) => void;
  onChangeDraft: (updater: (prev: AvailabilityMap) => AvailabilityMap) => void;
  onRequestSave: () => void;
  onRequestClearAll: () => void;
  onRequestApplyRoutine: () => void;
  onRequestIdentity: () => void;
  onInspectHeatmapCell: (cell: SlotHeatmapCell) => void;
}

const HEAT_LEVEL_CLASS: Record<number, string> = {
  0: "wp-heat-0",
  1: "wp-heat-1",
  2: "wp-heat-2",
  3: "wp-heat-3",
  4: "wp-heat-4",
};

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

export function AvailabilityGrid({
  event,
  mode,
  heatmap,
  teammateHints,
  draftAvailabilities,
  activeBrush,
  highlightedSlotKeys,
  canEdit,
  isDirty,
  isSaving,
  hasRoutineTemplate,
  onChangeBrush,
  onChangeDraft,
  onRequestSave,
  onRequestClearAll,
  onRequestApplyRoutine,
  onRequestIdentity,
  onInspectHeatmapCell,
}: AvailabilityGridProps) {
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<{
    active: boolean;
    brush: PaintBrushMode;
    visited: Set<string>;
  }>({
    active: false,
    brush: activeBrush,
    visited: new Set(),
  });

  const firstSlotKey = useMemo(() => {
    const firstCol = heatmap.columns[0];
    const firstTime = heatmap.timeSlots[0];
    if (!firstCol || !firstTime) return null;
    return createSlotKey(event.dateMode, firstCol, firstTime);
  }, [event.dateMode, heatmap.columns, heatmap.timeSlots]);

  const [focusedSlotKey, setFocusedSlotKey] = useState<string | null>(null);
  const [showTeammateHints, setShowTeammateHints] = useState(true);
  const [peekSlotKey, setPeekSlotKey] = useState<string | null>(null);

  const effectiveFocusKey = focusedSlotKey ?? firstSlotKey;
  const totalMembers = Math.max(heatmap.totalParticipantsCount, heatmap.filledCount);

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

  const paintSingleSlot = useCallback(
    (slotKey: string, brush: PaintBrushMode) => {
      onChangeDraft((prev) => applyPaintToSlot(prev, slotKey, brush));
    },
    [onChangeDraft]
  );

  const handleCellPointerDown = (
    slotKey: string,
    pointerEvent: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (mode !== "fill") return;
    if (!canEdit) {
      onRequestIdentity();
      return;
    }

    if (pointerEvent.button !== 0 && pointerEvent.pointerType === "mouse") {
      return;
    }

    pointerEvent.preventDefault();
    const strokeBrush = resolveStrokeBrush(draftAvailabilities, slotKey, activeBrush);
    strokeRef.current = {
      active: true,
      brush: strokeBrush,
      visited: new Set([slotKey]),
    };
    setFocusedSlotKey(slotKey);
    setPeekSlotKey(slotKey);
    paintSingleSlot(slotKey, strokeBrush);
  };

  const handlePaintSurfacePointerMove = (pointerEvent: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "fill" || !strokeRef.current.active) return;

    const hit = document.elementFromPoint(pointerEvent.clientX, pointerEvent.clientY);
    const cellButton =
      hit instanceof Element ? hit.closest<HTMLButtonElement>("[data-slot-key]") : null;
    const slotKey = cellButton?.dataset.slotKey;
    if (!slotKey || strokeRef.current.visited.has(slotKey)) return;

    strokeRef.current.visited.add(slotKey);
    setPeekSlotKey(slotKey);
    paintSingleSlot(slotKey, strokeRef.current.brush);
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
    if (!container || !(pathTarget instanceof HTMLButtonElement) || !pathTarget.dataset.slotKey) {
      return;
    }

    const allButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("[data-slot-key]"));
    const visibleCandidates: SpatialCandidateRect[] = [];
    for (const button of allButtons) {
      const id = button.dataset.slotKey;
      if (!id) continue;
      const isVisible =
        typeof button.checkVisibility === "function" ? button.checkVisibility() : true;
      if (!isVisible) continue;
      visibleCandidates.push({
        id,
        rect: button.getBoundingClientRect(),
      });
    }

    const currentRect: SpatialCandidateRect = {
      id: pathTarget.dataset.slotKey,
      rect: pathTarget.getBoundingClientRect(),
    };

    const nextSlotKey = pickSpatialNavigationTarget(currentRect, visibleCandidates, direction);
    if (!nextSlotKey) {
      // Pertahankan native boundary scrolling ketika tidak ada kandidat di arah yang ditekan
      return;
    }

    keyboardEvent.preventDefault();
    const targetButton = allButtons.find((btn) => btn.dataset.slotKey === nextSlotKey);
    if (targetButton) {
      setFocusedSlotKey(nextSlotKey);
      setPeekSlotKey(nextSlotKey);
      targetButton.focus();
      targetButton.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  };

  const markedCount = Object.keys(draftAvailabilities).length;
  const peekHint =
    mode === "fill" && showTeammateHints && peekSlotKey
      ? teammateHints.hintsBySlotKey[peekSlotKey]
      : null;
  const parsedPeek = peekSlotKey ? parseSlotKey(peekSlotKey) : null;

  return (
    <div className="grid gap-3">
      {/* Bar Aksi Cepat di Atas Grid */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {mode === "fill" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-border-ink bg-status-free px-2.5 py-1 text-status-free-text">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Bisa</span>
            </span>
            <span className="wp-tentative-pattern inline-flex items-center gap-1.5 rounded-lg border-2 border-status-tentative-border px-2.5 py-1 text-status-tentative-text">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Diusahakan 50:50</span>
            </span>

            {teammateHints.othersFilledCount > 0 ? (
              <button
                type="button"
                aria-pressed={showTeammateHints}
                onClick={() => setShowTeammateHints((prev) => !prev)}
                className={`wp-btn !min-h-9 !px-2.5 !text-xs ${
                  showTeammateHints ? "wp-btn-soft" : "wp-btn-secondary"
                }`}
              >
                {showTeammateHints ? (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Pilihan Teman ({teammateHints.othersFilledCount})</span>
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-text-secondary">
            <span>Proporsi (x/{Math.max(totalMembers, 1)}):</span>
            <div className="inline-flex items-center gap-1" aria-hidden="true">
              <span className="wp-heat-0 h-4 w-4 rounded border border-border-ink" />
              <span className="wp-heat-1 h-4 w-4 rounded border border-border-ink" />
              <span className="wp-heat-2 h-4 w-4 rounded border border-border-ink" />
              <span className="wp-heat-3 h-4 w-4 rounded border border-border-ink" />
              <span className="wp-heat-4 h-4 w-4 rounded border border-border-ink" />
            </div>
            <span className="text-text-muted">Semua bisa</span>
          </div>
        )}

        {mode === "fill" && canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {hasRoutineTemplate ? (
              <button
                type="button"
                onClick={onRequestApplyRoutine}
                className="wp-btn wp-btn-soft !min-h-10 !px-3 !text-xs"
              >
                <CalendarSync className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pakai Jadwal Rutinku</span>
              </button>
            ) : null}

            {markedCount > 0 ? (
              <button
                type="button"
                onClick={onRequestClearAll}
                className="wp-btn wp-btn-danger-soft !min-h-10 !px-3 !text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kosongkan</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Strip Intip Pilihan Teman saat Hover / Fokus di Isi Jadwalku */}
      {mode === "fill" && showTeammateHints && teammateHints.othersFilledCount > 0 ? (
        <div
          aria-live="polite"
          className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border-2 border-border-ink bg-surface-card px-3 py-1.5 text-xs font-semibold text-text-secondary shadow-[2px_2px_0_var(--border-ink)]"
        >
          <Users className="h-3.5 w-3.5 shrink-0 text-brand-hover" aria-hidden="true" />
          {peekHint && parsedPeek ? (
            <>
              <span className="font-mono font-bold text-text-primary">
                {formatColumnLabel(event.dateMode, parsedPeek.columnKey, "short")} ·{" "}
                {parsedPeek.time}
              </span>
              {peekHint.freeNames.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-status-free-bg px-2 py-0.5 font-bold text-status-free-text">
                  <Check className="h-3 w-3" aria-hidden="true" />
                  <span>{peekHint.freeNames.join(", ")}</span>
                </span>
              ) : null}
              {peekHint.tentativeNames.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-status-tentative-bg px-2 py-0.5 font-bold text-status-tentative-text">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>{peekHint.tentativeNames.join(", ")}</span>
                </span>
              ) : null}
            </>
          ) : (
            <span>
              Teman yang sudah isi:{" "}
              <strong className="text-text-primary">
                {teammateHints.othersFilledNames.join(", ")}
              </strong>
            </span>
          )}
        </div>
      ) : null}

      {/* Kontainer Grid dengan Scroll Horizontal Aman & Safe Scroll Zone di Kolom Jam */}
      <div
        role="region"
        tabIndex={0}
        aria-label={
          mode === "fill" ? "Grid isi jadwal ketersediaan" : "Grid hasil ketersediaan kelompok"
        }
        onPointerLeave={() => setPeekSlotKey(null)}
        className="wp-card overflow-x-auto bg-surface-card p-3 sm:p-4"
      >
        <div
          ref={gridContainerRef}
          role="grid"
          aria-label={mode === "fill" ? "Jadwal pilihanmu" : "Hasil jadwal kelompok"}
          onKeyDown={handleGridKeyDown}
          onPointerMove={handlePaintSurfacePointerMove}
          className="inline-flex min-w-full items-start gap-1.5"
        >
          {/* Kolom Label Jam — Safe Scroll Zone (touch-action: pan-y) */}
          <div
            className="wp-safe-scroll-zone sticky left-0 z-20 grid shrink-0 gap-1 bg-surface-card pr-2"
            aria-hidden="true"
          >
            <div className="flex h-11 items-center justify-center gap-1 rounded-lg border-2 border-border-subtle bg-surface-muted px-2 font-mono text-[11px] font-bold text-text-secondary">
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Jam</span>
            </div>

            {heatmap.timeSlots.map((time) => {
              const isHourMark = time.endsWith(":00");
              return (
                <div
                  key={`time-${time}`}
                  className={`flex h-10 items-center justify-end pr-1 font-mono text-xs ${
                    isHourMark ? "font-extrabold text-text-primary" : "font-medium text-text-muted"
                  }`}
                >
                  {isHourMark ? time : "·30"}
                </div>
              );
            })}
          </div>

          {/* Kolom Hari / Tanggal */}
          <div
            className={`grid flex-1 gap-1.5 ${mode === "fill" ? "wp-paint-surface" : ""}`}
            style={{
              gridTemplateColumns: `repeat(${heatmap.columns.length}, minmax(4.75rem, 1fr))`,
            }}
          >
            {heatmap.columns.map((columnKey) => (
              <div key={columnKey} role="rowgroup" className="wp-grid-col grid gap-1">
                <div
                  role="columnheader"
                  className="flex h-11 items-center justify-center rounded-lg border-2 border-border-ink bg-surface-muted px-2 text-center font-mono text-xs font-extrabold text-text-primary"
                >
                  {formatColumnLabel(event.dateMode, columnKey, "short")}
                </div>

                {heatmap.timeSlots.map((time) => {
                  const slotKey = createSlotKey(event.dateMode, columnKey, time);
                  const endTime = addMinutesToTime(time, SLOT_INTERVAL_MIN);
                  const isHalfHour = time.endsWith(":30");
                  const isFocusable = effectiveFocusKey === slotKey;

                  if (mode === "fill") {
                    const status = draftAvailabilities[slotKey];
                    const hint = showTeammateHints
                      ? teammateHints.hintsBySlotKey[slotKey]
                      : undefined;
                    const hasTeammateFree = Boolean(hint && hint.freeCount > 0);
                    const hasTeammateOnlyTentative = Boolean(
                      hint && hint.freeCount === 0 && hint.tentativeCount > 0
                    );

                    const statusLabel =
                      status === "free"
                        ? "Bisa"
                        : status === "tentative"
                          ? "Diusahakan 50:50"
                          : "Belum dipilih";
                    const teammateLabel = hint ? `, ${hint.totalCount} teman memilih jam ini` : "";

                    return (
                      <div key={slotKey} role="row" className="contents">
                        <button
                          type="button"
                          role="gridcell"
                          tabIndex={isFocusable ? 0 : -1}
                          data-slot-key={slotKey}
                          aria-selected={Boolean(status)}
                          aria-label={`${formatColumnLabel(event.dateMode, columnKey, "long")} ${time} sampai ${endTime}, ${statusLabel}${teammateLabel}`}
                          onFocus={() => {
                            setFocusedSlotKey(slotKey);
                            setPeekSlotKey(slotKey);
                          }}
                          onPointerEnter={() => setPeekSlotKey(slotKey)}
                          onPointerDown={(e) => handleCellPointerDown(slotKey, e)}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              if (!canEdit) {
                                onRequestIdentity();
                                return;
                              }
                              const nextBrush = resolveStrokeBrush(
                                draftAvailabilities,
                                slotKey,
                                activeBrush
                              );
                              paintSingleSlot(slotKey, nextBrush);
                            }
                          }}
                          className={`flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border-2 px-1.5 transition-colors ${
                            status === "free"
                              ? "border-border-ink bg-status-free text-status-free-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                              : status === "tentative"
                                ? "wp-tentative-pattern border-status-tentative-border text-status-tentative-text"
                                : hasTeammateFree
                                  ? "border-dashed border-status-free-border/75 bg-status-free-bg/75 text-status-free-text hover:border-solid hover:border-border-ink"
                                  : hasTeammateOnlyTentative
                                    ? "border-dashed border-status-tentative-border/75 bg-status-tentative-bg/80 text-status-tentative-text hover:border-solid hover:border-border-ink"
                                    : isHalfHour
                                      ? "border-border-subtle/80 bg-surface-canvas/70 text-transparent hover:border-border-ink"
                                      : "border-border-subtle bg-surface-card text-transparent hover:border-border-ink"
                          }`}
                        >
                          {status === "free" ? (
                            <Check className="h-4 w-4 shrink-0 stroke-[2.75]" aria-hidden="true" />
                          ) : status === "tentative" ? (
                            <Clock className="h-4 w-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
                          ) : null}

                          {hint ? (
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-extrabold leading-none ${
                                status === "free"
                                  ? "bg-white/75 text-status-free-text"
                                  : status === "tentative"
                                    ? "bg-white/85 text-status-tentative-text"
                                    : hasTeammateFree
                                      ? "bg-status-free/25 text-status-free-text"
                                      : "bg-status-tentative/25 text-status-tentative-text"
                              }`}
                            >
                              <Users className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                              <span>{status ? `+${hint.totalCount}` : hint.totalCount}</span>
                            </span>
                          ) : null}
                        </button>
                      </div>
                    );
                  }

                  // Heatmap Mode — proporsi jujur terhadap total anggota (1/n)
                  const cell = heatmap.cellsBySlotKey[slotKey];
                  const displayLevel = cell
                    ? computeDisplayHeatLevel(cell.rawScore, cell.freeCount, totalMembers)
                    : 0;
                  const levelClass = cell
                    ? cell.isTentativeOnly
                      ? "wp-tentative-pattern text-status-tentative-text border-status-tentative-border"
                      : `${HEAT_LEVEL_CLASS[displayLevel]} border-border-subtle`
                    : "wp-heat-0 border-border-subtle";
                  const isHighlighted = highlightedSlotKeys.has(slotKey);
                  const totalAvailable = cell ? cell.freeCount + cell.tentativeCount : 0;

                  return (
                    <div key={slotKey} role="row" className="contents">
                      <button
                        type="button"
                        role="gridcell"
                        tabIndex={isFocusable ? 0 : -1}
                        data-slot-key={slotKey}
                        aria-label={`${formatColumnLabel(event.dateMode, columnKey, "long")} ${time} sampai ${endTime}, ${cell?.freeCount ?? 0} dari ${totalMembers} bisa, ${cell?.tentativeCount ?? 0} diusahakan`}
                        onFocus={() => setFocusedSlotKey(slotKey)}
                        onClick={() => {
                          if (cell) onInspectHeatmapCell(cell);
                        }}
                        className={`flex h-10 w-full items-center justify-center gap-1 rounded-lg border-2 font-mono text-xs font-extrabold transition-all hover:border-border-ink ${levelClass} ${
                          isHighlighted
                            ? "!border-brand ring-2 ring-brand ring-offset-1"
                            : displayLevel >= 3
                              ? "!border-border-ink"
                              : ""
                        }`}
                      >
                        {cell && totalAvailable > 0 ? (
                          <>
                            <span>
                              {cell.isTentativeOnly
                                ? `${cell.tentativeCount}/${totalMembers}`
                                : cell.tentativeCount > 0
                                  ? `${cell.freeCount}+${cell.tentativeCount}/${totalMembers}`
                                  : `${cell.freeCount}/${totalMembers}`}
                            </span>
                            {cell.isTentativeOnly ? (
                              <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            ) : null}
                          </>
                        ) : (
                          <span className="opacity-25">–</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Floating Paint Mode Bar (khusus mode Isi Jadwalku) */}
      {mode === "fill" ? (
        <div className="wp-paint-bar" role="toolbar" aria-label="Alat penanda jadwal">
          <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-1.5 sm:flex-none">
              <button
                type="button"
                aria-pressed={activeBrush === "free"}
                onClick={() => onChangeBrush("free")}
                className={`wp-btn flex-1 !min-h-11 !px-2.5 !text-xs sm:flex-none sm:!px-3.5 sm:!text-sm ${
                  activeBrush === "free"
                    ? "!bg-status-free !text-status-free-text"
                    : "wp-btn-secondary"
                }`}
              >
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Bisa</span>
              </button>

              <button
                type="button"
                aria-pressed={activeBrush === "tentative"}
                onClick={() => onChangeBrush("tentative")}
                className={`wp-btn flex-1 !min-h-11 !px-2.5 !text-xs sm:flex-none sm:!px-3.5 sm:!text-sm ${
                  activeBrush === "tentative"
                    ? "wp-tentative-pattern !border-status-tentative-border !text-status-tentative-text"
                    : "wp-btn-secondary"
                }`}
              >
                <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>50:50</span>
              </button>

              <button
                type="button"
                aria-pressed={activeBrush === "erase"}
                onClick={() => onChangeBrush("erase")}
                className={`wp-btn flex-1 !min-h-11 !px-2.5 !text-xs sm:flex-none sm:!px-3.5 sm:!text-sm ${
                  activeBrush === "erase" ? "!bg-border-ink !text-white" : "wp-btn-secondary"
                }`}
              >
                <Eraser className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Hapus</span>
              </button>
            </div>

            {canEdit ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={onRequestSave}
                className="wp-btn wp-btn-primary w-full !min-h-11 sm:w-auto sm:!px-5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    <span>{isDirty ? "Simpan Jadwal" : "Simpan"}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestIdentity}
                className="wp-btn wp-btn-primary w-full !min-h-11 sm:w-auto sm:!px-5"
              >
                <span>Pilih Namamu Dulu</span>
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
