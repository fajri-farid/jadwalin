"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast-provider";
import {
  DAY_LABEL_SHORT,
  DAYS_OF_WEEK_ORDER,
  formatColumnLabel,
  normalizeColumns,
} from "@/lib/engine/slots";
import {
  addDaysIso,
  buildCalendarMonthGrid,
  formatHourOption,
  formatMonthYearIndonesian,
  getTodayIsoDate,
  parseRosterInput,
  validateCreateRoomDraft,
} from "@/lib/forms/room-form";
import { getScheduleRepository, RepositoryError } from "@/lib/repositories/schedule-repository";
import { formatRoomCodeDisplay, normalizeParticipantName } from "@/lib/utils/room-code";
import type { DateMode, DayOfWeek } from "@/types/schedule";

const WEEKDAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"] as const;
const DEFAULT_WEEK_DAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI"];
const START_HOURS = Array.from({ length: 24 }, (_, idx) => idx);
const END_HOURS = Array.from({ length: 24 }, (_, idx) => idx + 1);

const emptySubscribe = () => () => {};
const getServerTodayIso = () => "";
const getClientTodayIso = () => getTodayIsoDate();
const getServerTimezone = () => "Asia/Jakarta";
const getClientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
  } catch {
    return "Asia/Jakarta";
  }
};

export function CreateRoomForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const hostInputRef = useRef<HTMLInputElement | null>(null);
  const descInputRef = useRef<HTMLTextAreaElement | null>(null);

  const todayIso = useSyncExternalStore(emptySubscribe, getClientTodayIso, getServerTodayIso);
  const timezone = useSyncExternalStore(emptySubscribe, getClientTimezone, getServerTimezone);

  const [todayYear, todayMonth] = useMemo(() => {
    if (!todayIso) return [2026, 10];
    const [y, m] = todayIso.split("-").map(Number);
    return [y, m - 1];
  }, [todayIso]);

  const [title, setTitle] = useState("");
  const [hostName, setHostName] = useState("");
  const [hostEdited, setHostEdited] = useState(false);
  const [description, setDescription] = useState("");

  const [dateMode, setDateMode] = useState<DateMode>("specific_dates");
  const [customSpecificDates, setCustomSpecificDates] = useState<string[] | null>(null);
  const [weeklyDays, setWeeklyDays] = useState<DayOfWeek[]>(DEFAULT_WEEK_DAYS);
  const [customViewMonth, setCustomViewMonth] = useState<{ year: number; month: number } | null>(
    null
  );

  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(22);

  const [rosterInput, setRosterInput] = useState("");
  const [rosterNames, setRosterNames] = useState<string[]>([]);
  const [confirmClearRosterOpen, setConfirmClearRosterOpen] = useState(false);

  const [touched, setTouched] = useState<{
    title: boolean;
    hostName: boolean;
    description: boolean;
  }>({
    title: false,
    hostName: false,
    description: false,
  });
  const [blurred, setBlurred] = useState<{
    title: boolean;
    hostName: boolean;
    description: boolean;
  }>({
    title: false,
    hostName: false,
    description: false,
  });
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const specificDates = useMemo(() => {
    if (customSpecificDates !== null) {
      return customSpecificDates;
    }
    if (!todayIso) {
      return [];
    }
    return [todayIso, addDaysIso(todayIso, 1), addDaysIso(todayIso, 2)];
  }, [customSpecificDates, todayIso]);

  const viewMonth = customViewMonth ?? { year: todayYear, month: todayMonth };
  const effectiveHostName = hostEdited ? hostName : hostName || user?.displayName || "";
  const activeDates = dateMode === "specific_dates" ? specificDates : weeklyDays;

  const errors = useMemo(
    () =>
      validateCreateRoomDraft({
        title,
        description,
        hostName: effectiveHostName,
        dateMode,
        dates: activeDates,
        startHour,
        endHour,
        rosterNames,
      }),
    [title, description, effectiveHostName, dateMode, activeDates, startHour, endHour, rosterNames]
  );

  const calendarCells = useMemo(
    () => buildCalendarMonthGrid(viewMonth.year, viewMonth.month),
    [viewMonth.year, viewMonth.month]
  );

  const showTitleError = Boolean(
    errors.title && ((touched.title && blurred.title) || hasSubmitted)
  );
  const showHostError = Boolean(
    errors.hostName && ((touched.hostName && blurred.hostName) || hasSubmitted)
  );
  const showDescriptionError = Boolean(
    errors.description && ((touched.description && blurred.description) || hasSubmitted)
  );
  const showDatesError = Boolean(errors.dates && hasSubmitted);
  const showHoursError = Boolean(errors.hours && hasSubmitted);

  const shiftMonth = (delta: number) => {
    setCustomViewMonth((prev) => {
      const base = prev ?? { year: todayYear, month: todayMonth };
      const utc = new Date(Date.UTC(base.year, base.month + delta, 1));
      return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() };
    });
  };

  const toggleSpecificDate = (isoDate: string) => {
    setCustomSpecificDates((prev) => {
      const base =
        prev ?? (todayIso ? [todayIso, addDaysIso(todayIso, 1), addDaysIso(todayIso, 2)] : []);
      const exists = base.includes(isoDate);
      const next = exists ? base.filter((item) => item !== isoDate) : [...base, isoDate];
      return normalizeColumns("specific_dates", next);
    });
  };

  const toggleWeeklyDay = (day: DayOfWeek) => {
    setWeeklyDays((prev) => {
      const exists = prev.includes(day);
      const next = exists ? prev.filter((item) => item !== day) : [...prev, day];
      return normalizeColumns("days_of_week", next) as DayOfWeek[];
    });
  };

  const handleStartHourChange = (nextStart: number) => {
    setStartHour(nextStart);
    if (endHour <= nextStart) {
      setEndHour(Math.min(24, nextStart + 2));
    }
  };

  const commitRosterDraft = () => {
    if (!rosterInput.trim()) return;
    const merged = parseRosterInput(rosterInput, rosterNames).slice(0, 60);
    setRosterNames(merged);
    setRosterInput("");
  };

  const removeRosterName = (target: string) => {
    const normalized = normalizeParticipantName(target);
    setRosterNames((prev) => prev.filter((item) => normalizeParticipantName(item) !== normalized));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    setSubmitError(null);

    const pendingRoster = rosterInput.trim()
      ? parseRosterInput(rosterInput, rosterNames).slice(0, 60)
      : rosterNames;
    if (rosterInput.trim()) {
      setRosterNames(pendingRoster);
      setRosterInput("");
    }

    const currentErrors = validateCreateRoomDraft({
      title,
      description,
      hostName: effectiveHostName,
      dateMode,
      dates: activeDates,
      startHour,
      endHour,
      rosterNames: pendingRoster,
    });

    if (Object.keys(currentErrors).length > 0) {
      if (currentErrors.title) {
        titleInputRef.current?.focus();
      } else if (currentErrors.hostName) {
        hostInputRef.current?.focus();
      } else if (currentErrors.description) {
        descInputRef.current?.focus();
      }
      return;
    }

    if (!user) {
      setSubmitError("Masuk dengan akun Google terlebih dahulu untuk membuat room.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await getScheduleRepository().createEvent({
        title,
        description,
        dateMode,
        dates: activeDates,
        startHour,
        endHour,
        timezone,
        hostUid: user.uid,
        hostName: effectiveHostName,
        rosterNames: pendingRoster,
      });

      showToast({
        title: "Room Siap Dibagikan",
        message: `Kode room ${formatRoomCodeDisplay(result.roomCode.code)} sudah aktif.`,
        variant: "success",
      });
      router.push(`/r/${result.event.slug}`);
    } catch (err) {
      if (err instanceof RepositoryError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Room belum berhasil dibuat. Coba ulangi beberapa saat lagi.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby={`create-title-${uid}`} className="wp-card grid gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl border-2 border-border-ink bg-status-free-bg text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
          >
            <CalendarPlus className="h-5 w-5" />
          </span>
          <h2 id={`create-title-${uid}`} className="text-xl font-bold text-text-primary">
            Buat Room Jadwal Baru
          </h2>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-border-ink bg-surface-muted px-3 py-1 text-xs font-semibold text-text-secondary">
          <Globe className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{timezone}</span>
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        {/* Judul & Pembuat */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor={`title-${uid}`} className="text-sm font-bold text-text-primary">
              Judul Pertemuan
            </label>
            <span id={`title-hint-${uid}`} className="text-xs text-text-muted">
              Nama rapat atau kegiatan kelompok (3–100 huruf).
            </span>
            <input
              ref={titleInputRef}
              id={`title-${uid}`}
              name="title"
              type="text"
              required
              minLength={3}
              maxLength={100}
              placeholder="Mis. Rapat Kelompok Bab 3"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setTouched((prev) => ({ ...prev, title: true }));
              }}
              onBlur={() => setBlurred((prev) => ({ ...prev, title: true }))}
              aria-invalid={showTitleError ? "true" : "false"}
              aria-describedby={
                showTitleError ? `title-hint-${uid} title-err-${uid}` : `title-hint-${uid}`
              }
              className={`wp-input ${showTitleError ? "user-invalid-fallback" : ""}`}
            />
            <div id={`title-err-${uid}`} className="wp-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0" role="img" aria-label="Error" />
              <span>{errors.title ?? "Judul minimal 3 karakter."}</span>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor={`host-${uid}`} className="text-sm font-bold text-text-primary">
              Nama Kamu
            </label>
            <span id={`host-hint-${uid}`} className="text-xs text-text-muted">
              Ditampilkan sebagai pembuat jadwal di room.
            </span>
            <input
              ref={hostInputRef}
              id={`host-${uid}`}
              name="hostName"
              type="text"
              required
              maxLength={50}
              placeholder="Mis. Raka"
              value={effectiveHostName}
              onChange={(event) => {
                setHostEdited(true);
                setHostName(event.target.value);
                setTouched((prev) => ({ ...prev, hostName: true }));
              }}
              onBlur={() => setBlurred((prev) => ({ ...prev, hostName: true }))}
              aria-invalid={showHostError ? "true" : "false"}
              aria-describedby={
                showHostError ? `host-hint-${uid} host-err-${uid}` : `host-hint-${uid}`
              }
              className={`wp-input ${showHostError ? "user-invalid-fallback" : ""}`}
            />
            <div id={`host-err-${uid}`} className="wp-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0" role="img" aria-label="Error" />
              <span>{errors.hostName ?? "Masukkan namamu."}</span>
            </div>
          </div>
        </div>

        {/* Deskripsi Singkat (Wajib) */}
        <div className="grid gap-1.5">
          <label htmlFor={`desc-${uid}`} className="text-sm font-bold text-text-primary">
            Deskripsi Singkat
          </label>
          <span id={`desc-hint-${uid}`} className="text-xs text-text-muted">
            Agenda singkat, lokasi ketemu, atau link rapat (3–300 huruf).
          </span>
          <textarea
            ref={descInputRef}
            id={`desc-${uid}`}
            name="description"
            required
            minLength={3}
            maxLength={300}
            placeholder="Mis. Kumpul di perpustakaan lantai 2 atau online via Google Meet."
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              setTouched((prev) => ({ ...prev, description: true }));
            }}
            onBlur={() => setBlurred((prev) => ({ ...prev, description: true }))}
            aria-invalid={showDescriptionError ? "true" : "false"}
            aria-describedby={
              showDescriptionError ? `desc-hint-${uid} desc-err-${uid}` : `desc-hint-${uid}`
            }
            className={`wp-textarea ${showDescriptionError ? "user-invalid-fallback" : ""}`}
          />
          <div id={`desc-err-${uid}`} className="wp-error-msg">
            <AlertCircle className="h-4 w-4 shrink-0" role="img" aria-label="Error" />
            <span>{errors.description ?? "Deskripsi minimal 3 karakter."}</span>
          </div>
        </div>

        {/* Switcher Mode Tanggal & Pemilih Tanggal */}
        <div className="wp-card-muted grid gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-text-primary">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>Pilihan Hari atau Tanggal</span>
            </span>

            <div
              role="tablist"
              aria-label="Mode kolom jadwal"
              className="inline-flex gap-1 rounded-xl border-2 border-border-ink bg-surface-card p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === "specific_dates"}
                onClick={() => setDateMode("specific_dates")}
                className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors ${
                  dateMode === "specific_dates"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-surface-muted"
                }`}
              >
                Tanggal Spesifik
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dateMode === "days_of_week"}
                onClick={() => setDateMode("days_of_week")}
                className={`min-h-10 rounded-lg px-3 text-xs font-bold transition-colors ${
                  dateMode === "days_of_week"
                    ? "bg-brand text-white"
                    : "text-text-secondary hover:bg-surface-muted"
                }`}
              >
                Hari Mingguan
              </button>
            </div>
          </div>

          {dateMode === "specific_dates" ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="wp-btn wp-btn-secondary !px-2.5"
                    aria-label="Bulan sebelumnya"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-36 text-center text-sm font-bold text-text-primary">
                    {formatMonthYearIndonesian(viewMonth.year, viewMonth.month)}
                  </span>
                  <button
                    type="button"
                    className="wp-btn wp-btn-secondary !px-2.5"
                    aria-label="Bulan berikutnya"
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!todayIso}
                    className="wp-btn wp-btn-soft !min-h-10 !px-3 !text-xs"
                    onClick={() => {
                      if (!todayIso) return;
                      setCustomSpecificDates([
                        todayIso,
                        addDaysIso(todayIso, 1),
                        addDaysIso(todayIso, 2),
                      ]);
                    }}
                  >
                    3 Hari ke Depan
                  </button>
                  {specificDates.length > 0 ? (
                    <button
                      type="button"
                      className="wp-btn wp-btn-secondary !min-h-10 !px-3 !text-xs"
                      onClick={() => setCustomSpecificDates([])}
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border-2 border-border-ink bg-surface-card p-3">
                <div className="mb-2 grid grid-cols-7 gap-1 text-center font-mono text-xs font-bold text-text-muted">
                  {WEEKDAY_HEADERS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell) => {
                    const selected = specificDates.includes(cell.isoDate);
                    const isToday = cell.isoDate === todayIso;
                    return (
                      <button
                        key={cell.isoDate}
                        type="button"
                        aria-pressed={selected}
                        aria-label={formatColumnLabel("specific_dates", cell.isoDate, "long")}
                        onClick={() => toggleSpecificDate(cell.isoDate)}
                        className={`min-h-11 rounded-lg border-2 font-mono text-sm font-bold transition-colors ${
                          selected
                            ? "border-border-ink bg-brand text-white shadow-[2px_2px_0_var(--border-ink)]"
                            : cell.inCurrentMonth
                              ? isToday
                                ? "border-brand bg-brand-soft text-brand-hover hover:bg-indigo-100"
                                : "border-transparent bg-surface-canvas text-text-primary hover:border-border-ink"
                              : "border-transparent bg-transparent text-text-muted/60 hover:border-border-subtle"
                        }`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              {specificDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {specificDates.map((iso) => (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => toggleSpecificDate(iso)}
                      aria-label={`Hapus tanggal ${formatColumnLabel("specific_dates", iso, "long")}`}
                      className="wp-chip !min-h-10 !bg-status-free-bg !text-status-free-text"
                    >
                      <span className="font-mono text-xs">
                        {formatColumnLabel("specific_dates", iso, "short")}
                      </span>
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK_ORDER.map((day) => {
                const pressed = weeklyDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => toggleWeeklyDay(day)}
                    className="wp-chip min-w-14 justify-center"
                  >
                    {DAY_LABEL_SHORT[day]}
                  </button>
                );
              })}
            </div>
          )}

          {showDatesError ? (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm font-semibold text-status-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errors.dates}</span>
            </div>
          ) : null}
        </div>

        {/* Rentang Jam */}
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <span>Rentang Jam</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <label
                htmlFor={`start-hour-${uid}`}
                className="text-xs font-semibold text-text-muted"
              >
                Mulai
              </label>
              <select
                id={`start-hour-${uid}`}
                value={startHour}
                onChange={(event) => handleStartHourChange(Number(event.target.value))}
                className="wp-select font-mono text-sm font-bold"
              >
                {START_HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHourOption(hour)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <label htmlFor={`end-hour-${uid}`} className="text-xs font-semibold text-text-muted">
                Selesai
              </label>
              <select
                id={`end-hour-${uid}`}
                value={endHour}
                onChange={(event) => setEndHour(Number(event.target.value))}
                className="wp-select font-mono text-sm font-bold"
              >
                {END_HOURS.map((hour) => (
                  <option key={hour} value={hour} disabled={hour <= startHour}>
                    {formatHourOption(hour)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {showHoursError ? (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm font-semibold text-status-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errors.hours}</span>
            </div>
          ) : null}
        </div>

        {/* Daftar Anggota Kelompok (Roster Opsional) */}
        <div className="wp-card-muted grid gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`roster-input-${uid}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-text-primary"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Daftar Anggota Kelompok (opsional)</span>
            </label>
            <div className="flex items-center gap-2">
              {rosterNames.length > 0 ? (
                <span className="rounded-full border-2 border-border-ink bg-surface-card px-2.5 py-0.5 font-mono text-xs font-bold">
                  {rosterNames.length} orang
                </span>
              ) : null}
              {rosterNames.length >= 2 ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearRosterOpen(true)}
                  className="wp-btn wp-btn-danger-soft !min-h-10 !px-3 !text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kosongkan Daftar</span>
                </button>
              ) : null}
            </div>
          </div>

          <span id={`roster-hint-${uid}`} className="text-xs text-text-muted">
            Pisahkan nama teman dengan koma atau Enter (mis. Andi, Budi, Citra) agar mereka tinggal
            klik namanya saat masuk.
          </span>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`roster-input-${uid}`}
              type="text"
              value={rosterInput}
              placeholder="Ketik nama teman lalu tekan Tambah"
              aria-describedby={`roster-hint-${uid}`}
              onChange={(event) => {
                const value = event.target.value;
                if (value.includes(",") || value.includes("\n")) {
                  const merged = parseRosterInput(value, rosterNames).slice(0, 60);
                  setRosterNames(merged);
                  setRosterInput("");
                  return;
                }
                setRosterInput(value);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.nativeEvent.isComposing &&
                  event.nativeEvent.keyCode !== 229
                ) {
                  event.preventDefault();
                  commitRosterDraft();
                }
              }}
              className="wp-input flex-1"
            />
            <button
              type="button"
              onClick={commitRosterDraft}
              className="wp-btn wp-btn-secondary shrink-0"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Tambah</span>
            </button>
          </div>

          {rosterNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {rosterNames.map((member) => (
                <button
                  key={member}
                  type="button"
                  onClick={() => removeRosterName(member)}
                  aria-label={`Hapus ${member} dari daftar`}
                  className="wp-chip !min-h-10"
                >
                  <span>{member}</span>
                  <X className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          {errors.rosterNames ? (
            <div
              role="alert"
              className="flex items-center gap-2 text-sm font-semibold text-status-danger"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{errors.rosterNames}</span>
            </div>
          ) : null}
        </div>

        {submitError ? (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl border-2 border-status-danger-border bg-status-danger-bg p-3 text-sm font-semibold text-status-danger"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="wp-btn wp-btn-primary w-full min-h-12 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Membuat Room...</span>
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>Buat Room &amp; Dapatkan Kode</span>
            </>
          )}
        </button>
      </form>

      <ConfirmDialog
        open={confirmClearRosterOpen}
        onOpenChange={setConfirmClearRosterOpen}
        eyebrow="Daftar Anggota"
        title="Yakin hapus semua nama anggota?"
        description={
          <>
            Sebanyak <strong>{rosterNames.length} nama anggota</strong> yang sudah kamu masukkan di
            form ini akan dikosongkan.
          </>
        }
        confirmLabel="Ya, Kosongkan Daftar"
        cancelLabel="Batal"
        tone="danger"
        onConfirm={() => {
          setRosterNames([]);
          showToast({
            title: "Daftar Dikosongkan",
            message: "Semua nama anggota sudah dihapus dari form.",
            variant: "danger",
          });
        }}
      />
    </section>
  );
}
