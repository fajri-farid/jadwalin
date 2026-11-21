"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2, Lock, X } from "lucide-react";
import { isValidPin } from "@/lib/security/pin";

interface SetPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantName: string;
  onSavePin: (newPin: string) => Promise<void>;
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
 * Dialog ringan untuk memasang PIN 4 digit opsional pada peserta Guest.
 */
export function SetPinDialog({
  open,
  onOpenChange,
  participantName,
  onSavePin,
}: SetPinDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close("");
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      setPin("");
      setErrorMsg(null);
      setIsSaving(false);
      onOpenChangeRef.current(false);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = pin.replace(/\D/g, "").slice(0, 4);
    if (!isValidPin(digits)) {
      setErrorMsg("PIN harus terdiri dari tepat 4 angka.");
      return;
    }

    setErrorMsg(null);
    setIsSaving(true);
    try {
      await onSavePin(digits);
      dialogRef.current?.close("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Belum bisa memasang PIN.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dialog-sheet-handle" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
          >
            <Lock className="h-5 w-5" />
          </span>
          <div className="grid gap-0.5">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-muted">
              Keamanan Jadwal
            </span>
            <h2 id={titleId} className="text-lg font-extrabold text-text-primary">
              Pasang PIN untuk {participantName}
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="wp-btn wp-btn-secondary !px-2.5"
          aria-label="Tutup dialog PIN"
          onClick={() => dialogRef.current?.close("")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-sm text-text-secondary">
        PIN 4 angka menjaga jadwalmu agar tidak diubah orang lain dan tetap bisa kamu buka dari HP
        atau laptop lain.
      </p>

      {errorMsg ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border-2 border-status-danger-border bg-status-danger-bg p-3 text-sm font-semibold text-status-danger"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <label htmlFor={inputId} className="text-sm font-bold text-text-primary">
            PIN 4 Angka
          </label>
          <input
            id={inputId}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={4}
            autoFocus
            placeholder="••••"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
              setErrorMsg(null);
            }}
            className="wp-code-input"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => dialogRef.current?.close("")}
            className="wp-btn wp-btn-secondary w-full sm:w-auto"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSaving || pin.length < 4}
            className="wp-btn wp-btn-primary w-full sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Lock className="h-4 w-4" aria-hidden="true" />
            )}
            <span>Kunci dengan PIN</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
