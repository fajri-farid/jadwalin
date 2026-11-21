"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Check, KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";
import { getScheduleRepository } from "@/lib/repositories/schedule-repository";
import {
  formatRoomCodeDisplay,
  isValidRoomCode,
  sanitizeRoomCodeInput,
} from "@/lib/utils/room-code";

interface JoinByCodeCardProps {
  initialCode?: string;
}

export function JoinByCodeCard({ initialCode = "" }: JoinByCodeCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const inputId = `join-code-${uid}`;
  const hintId = `join-hint-${uid}`;
  const errorId = `join-error-${uid}`;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [code, setCode] = useState(() => sanitizeRoomCodeInput(initialCode));
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasBlurred, setHasBlurred] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCodeValid = isValidRoomCode(code);
  const showFormatError = !isCodeValid && ((hasInteracted && hasBlurred) || hasSubmitted);
  const visibleError =
    lookupError ?? (showFormatError ? "Kode room harus 6 angka, misalnya 482910." : null);
  const showError = Boolean(visibleError);
  const describedBy = showError ? `${hintId} ${errorId}` : hintId;

  const handleCodeChange = (rawValue: string) => {
    const digits = sanitizeRoomCodeInput(rawValue);
    setCode(digits);
    setHasInteracted(true);
    setLookupError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setLookupError(null);

    if (!isValidRoomCode(code)) {
      inputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const record = await getScheduleRepository().resolveRoomCode(code);
      if (!record) {
        setLookupError(
          `Kode room ${formatRoomCodeDisplay(code)} tidak ditemukan. Periksa lagi angka dari grup chat.`
        );
        inputRef.current?.focus();
        return;
      }

      showToast({
        title: "Room Ditemukan",
        message: `Masuk ke room ${formatRoomCodeDisplay(code)}.`,
        variant: "success",
      });
      router.push(`/r/${record.slug}`);
    } catch {
      setLookupError("Belum berhasil mengecek kode room. Coba sebentar lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby={`join-title-${uid}`} className="wp-card grid gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl border-2 border-border-ink bg-brand-soft text-brand-hover shadow-[2px_2px_0_var(--border-ink)]"
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 id={`join-title-${uid}`} className="text-xl font-bold text-text-primary">
            Gabung Pakai Kode Room
          </h2>
        </div>
        {isCodeValid ? (
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-border-ink bg-status-free-bg px-3 py-1 text-xs font-bold text-status-free-text">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{formatRoomCodeDisplay(code)}</span>
          </span>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor={inputId} className="text-sm font-bold text-text-primary">
            Kode Room (6 Angka)
          </label>
          <span id={hintId} className="text-xs text-text-muted">
            Masukkan 6 angka kode room dari grup chat kamu (contoh: 482910).
          </span>
          <input
            ref={inputRef}
            id={inputId}
            name="roomCode"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={12}
            autoComplete="one-time-code"
            placeholder="482910"
            required
            value={code}
            onChange={(event) => handleCodeChange(event.target.value)}
            onBlur={() => setHasBlurred(true)}
            aria-invalid={showError ? "true" : "false"}
            aria-describedby={describedBy}
            className={`wp-code-input ${showError ? "user-invalid-fallback" : ""}`}
          />
          <div id={errorId} className="wp-error-msg">
            <AlertCircle className="h-4 w-4 shrink-0" role="img" aria-label="Error" />
            <span>{visibleError ?? "Kode room harus 6 angka, misalnya 482910."}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="wp-btn wp-btn-primary w-full min-h-12 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Mengecek Kode...</span>
            </>
          ) : (
            <>
              <span>Masuk ke Room</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </section>
  );
}
