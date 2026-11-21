"use client";

import { useEffect, useId, useRef } from "react";
import { Check, Clock, Users, X } from "lucide-react";
import {
  addMinutesToTime,
  formatColumnLabel,
  formatTimeRange,
  SLOT_INTERVAL_MIN,
} from "@/lib/engine/slots";
import type { DateMode, SlotHeatmapCell } from "@/types/schedule";

interface SlotDetailDialogProps {
  cell: SlotHeatmapCell | null;
  dateMode: DateMode;
  filledCount: number;
  totalParticipantsCount: number;
  pendingNames: readonly string[];
  onClose: () => void;
}

function isPointerOutsideDialog(event: PointerEvent, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/**
 * Lembar detail peserta per slot Heatmap berbasis `<dialog>` native (Bottom Sheet di HP).
 */
export function SlotDetailDialog({
  cell,
  dateMode,
  filledCount,
  totalParticipantsCount,
  pendingNames,
  onClose,
}: SlotDetailDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (cell && !dialog.open) {
      dialog.showModal();
    } else if (!cell && dialog.open) {
      dialog.close("");
    }
  }, [cell]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onCloseRef.current();
    };

    dialog.addEventListener("close", handleClose);

    let cleanupBackdrop: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;

      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isPointerOutsideDialog(event, dialog);
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isPointerOutsideDialog(event, dialog)) {
          dialog.close("");
        }
        pressedOutside = false;
      };

      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupBackdrop?.();
    };
  }, []);

  const endTime = cell ? addMinutesToTime(cell.time, SLOT_INTERVAL_MIN) : "";
  const totalMembers = Math.max(totalParticipantsCount, filledCount, 1);
  const freePct = cell ? Math.round((cell.freeCount / totalMembers) * 100) : 0;
  const tentativePct = cell ? Math.round((cell.tentativeCount / totalMembers) * 100) : 0;

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dialog-sheet-handle" aria-hidden="true" />

      {cell ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
                {formatColumnLabel(dateMode, cell.columnKey, "long")}
              </span>
              <h2 id={titleId} className="font-mono text-xl font-extrabold text-text-primary">
                {formatTimeRange(cell.time, endTime)}
              </h2>
            </div>

            <button
              type="button"
              autoFocus
              className="wp-btn wp-btn-secondary !px-2.5"
              aria-label="Tutup rincian slot"
              onClick={() => dialogRef.current?.close("")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Bar Proporsi Visual */}
          <div className="grid gap-2">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full border-2 border-border-ink bg-surface-muted"
              aria-hidden="true"
            >
              {freePct > 0 ? (
                <div
                  className="h-full bg-status-free"
                  style={{ width: `${Math.min(100, freePct)}%` }}
                />
              ) : null}
              {tentativePct > 0 ? (
                <div
                  className="h-full bg-status-tentative"
                  style={{ width: `${Math.min(100 - freePct, tentativePct)}%` }}
                />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold text-text-secondary">
              <span className="inline-flex items-center gap-1 text-status-free-text">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {cell.freeCount}/{totalMembers} bisa
              </span>
              <span className="inline-flex items-center gap-1 text-status-tentative-text">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {cell.tentativeCount} diusahakan
              </span>
              <span className="inline-flex items-center gap-1 text-text-muted">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {pendingNames.length > 0
                  ? `${pendingNames.length} belum isi`
                  : `${cell.unavailableCount} tidak bisa`}
              </span>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-status-free-text">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Bisa ({cell.freeNames.length})</span>
              </span>
              {cell.freeNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {cell.freeNames.map((name) => (
                    <span
                      key={`free-${name}`}
                      className="inline-flex items-center rounded-lg border-2 border-status-free-border bg-status-free-bg px-2.5 py-1 text-xs font-bold text-status-free-text"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-text-muted">Belum ada yang menandai bisa.</span>
              )}
            </div>

            <div className="grid gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-status-tentative-text">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Diusahakan 50:50 ({cell.tentativeNames.length})</span>
              </span>
              {cell.tentativeNames.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {cell.tentativeNames.map((name) => (
                    <span
                      key={`tent-${name}`}
                      className="wp-tentative-pattern inline-flex items-center rounded-lg border-2 border-status-tentative-border px-2.5 py-1 text-xs font-bold text-status-tentative-text"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-text-muted">Tidak ada yang menandai 50:50.</span>
              )}
            </div>

            {cell.unavailableNames.length > 0 ? (
              <div className="grid gap-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-text-muted">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tidak Bisa ({cell.unavailableNames.length})</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {cell.unavailableNames.map((name) => (
                    <span
                      key={`unavail-${name}`}
                      className="inline-flex items-center rounded-lg border border-border-subtle bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text-secondary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {pendingNames.length > 0 ? (
              <div className="grid gap-1.5 border-t border-border-subtle pt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Belum mengisi ({pendingNames.length}):</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {pendingNames.map((name) => (
                    <span
                      key={`pending-${name}`}
                      className="inline-flex items-center rounded-lg border border-dashed border-border-ink bg-surface-card px-2.5 py-1 text-xs font-semibold text-text-muted"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
