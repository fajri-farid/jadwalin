"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  LogIn,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { AuthUser } from "@/lib/firebase/auth";
import { isValidPin } from "@/lib/security/pin";
import { normalizeParticipantName } from "@/lib/utils/room-code";
import type { Participant } from "@/types/schedule";

export interface IdentitySelectionPayload {
  participant: Participant;
  verifiedPin?: string;
  trustedDevice: boolean;
}

interface IdentityPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTitle: string;
  participants: readonly Participant[];
  activeParticipantId: string | null;
  trustedParticipantId: string | null;
  authUser: AuthUser | null;
  onSignInGoogle: () => Promise<AuthUser | null>;
  onClaimRoster: (input: {
    participant: Participant;
    pin?: string;
    googleUid?: string | null;
    trustedDevice?: boolean;
  }) => Promise<IdentitySelectionPayload>;
  onCreateWalkIn: (input: {
    name: string;
    newPin?: string;
    googleUid?: string | null;
  }) => Promise<IdentitySelectionPayload>;
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

function sanitizePinDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

/**
 * Modal native `<dialog>` pemilih identitas ("Halo! Kamu siapa di kelompok ini?")
 * mendukung klaim Roster, verifikasi PIN 4 digit, tambah nama baru, serta 1-klik Google.
 */
export function IdentityPickerModal({
  open,
  onOpenChange,
  roomTitle,
  participants,
  activeParticipantId,
  trustedParticipantId,
  authUser,
  onSignInGoogle,
  onClaimRoster,
  onCreateWalkIn,
}: IdentityPickerModalProps) {
  const titleId = useId();
  const walkInInputId = useId();
  const walkInPinId = useId();
  const verifyPinId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  const [pinTarget, setPinTarget] = useState<Participant | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [useNewPin, setUseNewPin] = useState(false);
  const [walkInPin, setWalkInPin] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      setPinTarget(null);
      setPinValue("");
      setErrorMsg(null);
      setBusyKey(null);
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

  const closeModal = () => {
    dialogRef.current?.close("");
  };

  const handleSelectRosterMember = async (member: Participant) => {
    setErrorMsg(null);

    if (member.googleUid) {
      if (authUser && authUser.uid === member.googleUid) {
        setBusyKey(`roster:${member.id}`);
        try {
          await onClaimRoster({
            participant: member,
            googleUid: authUser.uid,
            trustedDevice: true,
          });
          closeModal();
        } catch (err) {
          setErrorMsg(
            err instanceof Error ? err.message : "Gagal memilih nama dari daftar kelompok."
          );
        } finally {
          setBusyKey(null);
        }
        return;
      }

      setErrorMsg(
        `Nama "${member.name}" terikat ke akun Google pemiliknya. Masuk dengan akun Google tersebut untuk mengeditnya.`
      );
      return;
    }

    const isTrustedHere = trustedParticipantId === member.id;
    if (member.pinHash && !isTrustedHere) {
      setPinTarget(member);
      setPinValue("");
      return;
    }

    setBusyKey(`roster:${member.id}`);
    try {
      await onClaimRoster({
        participant: member,
        trustedDevice: isTrustedHere,
      });
      closeModal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memilih nama dari daftar kelompok.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmitPinVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pinTarget) return;

    const cleanPin = sanitizePinDigits(pinValue);
    if (!isValidPin(cleanPin)) {
      setErrorMsg("Masukkan tepat 4 angka PIN.");
      return;
    }

    setErrorMsg(null);
    setBusyKey("pin");
    try {
      await onClaimRoster({
        participant: pinTarget,
        pin: cleanPin,
        trustedDevice: false,
      });
      closeModal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "PIN 4 digit belum cocok.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSubmitWalkIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = walkInName.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setErrorMsg("Ketik namamu dulu sebelum melanjutkan.");
      return;
    }

    const normalized = normalizeParticipantName(trimmed);
    const existingMatch = participants.find((item) => item.normalizedName === normalized);
    if (existingMatch) {
      await handleSelectRosterMember(existingMatch);
      return;
    }

    const cleanNewPin = useNewPin ? sanitizePinDigits(walkInPin) : undefined;
    if (useNewPin && (!cleanNewPin || !isValidPin(cleanNewPin))) {
      setErrorMsg("PIN opsional harus tepat 4 angka.");
      return;
    }

    setErrorMsg(null);
    setBusyKey("walkin");
    try {
      await onCreateWalkIn({
        name: trimmed,
        newPin: cleanNewPin,
      });
      setWalkInName("");
      setWalkInPin("");
      setUseNewPin(false);
      closeModal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Belum bisa menambahkan namamu.");
    } finally {
      setBusyKey(null);
    }
  };

  const handleContinueWithGoogle = async () => {
    setErrorMsg(null);
    setBusyKey("google");
    try {
      const signedIn = authUser ?? (await onSignInGoogle());
      if (!signedIn) {
        return;
      }

      const boundMatch = participants.find((item) => item.googleUid === signedIn.uid);
      if (boundMatch) {
        await onClaimRoster({
          participant: boundMatch,
          googleUid: signedIn.uid,
          trustedDevice: true,
        });
        closeModal();
        return;
      }

      const normalizedGoogleName = normalizeParticipantName(signedIn.displayName);
      const freeRosterMatch = participants.find(
        (item) => item.normalizedName === normalizedGoogleName && !item.googleUid && !item.pinHash
      );

      if (freeRosterMatch) {
        await onClaimRoster({
          participant: freeRosterMatch,
          googleUid: signedIn.uid,
          trustedDevice: true,
        });
        closeModal();
        return;
      }

      await onCreateWalkIn({
        name: signedIn.displayName,
        googleUid: signedIn.uid,
      });
      closeModal();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal masuk dengan akun Google.");
    } finally {
      setBusyKey(null);
    }
  };

  const isBusy = busyKey !== null;

  return (
    <dialog
      ref={dialogRef}
      className="wp-dialog"
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
    >
      <div className="dialog-sheet-handle" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-hover">
            {roomTitle}
          </span>
          <h2 id={titleId} className="text-xl font-extrabold leading-snug text-text-primary">
            {pinTarget ? `Masukkan PIN ${pinTarget.name}` : "Kamu siapa di kelompok ini?"}
          </h2>
        </div>

        <button
          type="button"
          className="wp-btn wp-btn-secondary !px-2.5"
          aria-label="Tutup dialog pilih nama"
          onClick={closeModal}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border-2 border-status-danger-border bg-status-danger-bg p-3 text-sm font-semibold text-status-danger"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {pinTarget ? (
        <form onSubmit={handleSubmitPinVerify} className="grid gap-4">
          <p className="text-sm text-text-secondary">
            Jadwal <strong>{pinTarget.name}</strong> dikunci dengan PIN 4 angka. Masukkan PIN
            tersebut untuk lanjut mengedit.
          </p>

          <div className="grid gap-1.5">
            <label htmlFor={verifyPinId} className="text-sm font-bold text-text-primary">
              PIN 4 Angka
            </label>
            <input
              id={verifyPinId}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={4}
              autoFocus
              placeholder="••••"
              value={pinValue}
              onChange={(event) => {
                setPinValue(sanitizePinDigits(event.target.value));
                setErrorMsg(null);
              }}
              className="wp-code-input"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                setPinTarget(null);
                setPinValue("");
                setErrorMsg(null);
              }}
              className="wp-btn wp-btn-secondary w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Kembali</span>
            </button>
            <button
              type="submit"
              disabled={isBusy || pinValue.length < 4}
              className="wp-btn wp-btn-primary w-full sm:w-auto"
            >
              {busyKey === "pin" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Lock className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Buka Jadwal</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4">
          {/* Jalur 1: Lanjut dengan Google 1-Klik */}
          <button
            type="button"
            disabled={isBusy}
            onClick={handleContinueWithGoogle}
            className="wp-btn wp-btn-primary w-full justify-between"
          >
            <span className="inline-flex items-center gap-2">
              {busyKey === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : authUser ? (
                <UserCheck className="h-4 w-4" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {authUser ? `Lanjut sebagai ${authUser.displayName}` : "Lanjut dengan Google"}
              </span>
            </span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold">Google</span>
          </button>

          {/* Jalur 2: Daftar Anggota Kelompok (Roster) */}
          {participants.length > 0 ? (
            <div className="wp-card-muted grid gap-2.5 p-3.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-text-secondary">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Pilih dari Daftar Anggota</span>
              </span>

              <div className="flex flex-wrap gap-2">
                {participants.map((member) => {
                  const isFilled = member.status === "filled";
                  const isSelected = activeParticipantId === member.id;
                  const loadingThis = busyKey === `roster:${member.id}`;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      disabled={isBusy}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectRosterMember(member)}
                      className={`wp-chip ${
                        isSelected
                          ? ""
                          : isFilled
                            ? "!bg-status-free-bg !text-status-free-text"
                            : ""
                      }`}
                    >
                      {loadingThis ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : isFilled ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      ) : (
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-status-tentative-border"
                          aria-hidden="true"
                        />
                      )}
                      <span>{member.name}</span>
                      {member.pinHash ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Jalur 3: Tambah Nama Baru (Walk-In Guest) */}
          <form
            onSubmit={handleSubmitWalkIn}
            className="grid gap-3 border-t-2 border-border-subtle pt-3"
          >
            <label
              htmlFor={walkInInputId}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-text-primary"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Namamu belum ada? Ketik di sini</span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={walkInInputId}
                type="text"
                maxLength={50}
                placeholder="Mis. Citra"
                value={walkInName}
                onChange={(event) => {
                  setWalkInName(event.target.value);
                  setErrorMsg(null);
                }}
                className="wp-input flex-1"
              />
              <button
                type="submit"
                disabled={isBusy || !walkInName.trim()}
                className="wp-btn wp-btn-secondary shrink-0"
              >
                {busyKey === "walkin" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Masuk</span>
              </button>
            </div>

            <div className="grid gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-text-secondary">
                <input
                  type="checkbox"
                  checked={useNewPin}
                  onChange={(event) => {
                    setUseNewPin(event.target.checked);
                    if (!event.target.checked) setWalkInPin("");
                  }}
                  className="h-4 w-4 accent-brand"
                />
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Kunci jadwal dengan PIN 4 angka (opsional)</span>
              </label>

              {useNewPin ? (
                <input
                  id={walkInPinId}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={4}
                  placeholder="4 angka PIN (mis. 1234)"
                  aria-label="PIN 4 angka opsional"
                  value={walkInPin}
                  onChange={(event) => {
                    setWalkInPin(sanitizePinDigits(event.target.value));
                    setErrorMsg(null);
                  }}
                  className="wp-input font-mono tracking-widest"
                />
              ) : null}
            </div>
          </form>

          <button
            type="button"
            onClick={closeModal}
            className="text-center text-xs font-bold text-text-muted underline-offset-4 hover:text-text-primary hover:underline"
          >
            Lihat hasil grup dulu tanpa memilih nama
          </button>
        </div>
      )}
    </dialog>
  );
}
