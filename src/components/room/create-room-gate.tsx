"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarPlus,
  KeyRound,
  LayoutGrid,
  LogIn,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { CreateRoomForm } from "@/components/room/create-room-form";
import { useToast } from "@/components/ui/toast-provider";

const HOST_BENEFITS = [
  {
    icon: LayoutGrid,
    label: "Tersimpan di Dashboard",
    toneClass: "bg-brand-soft text-brand-hover",
  },
  {
    icon: ShieldCheck,
    label: "Bisa edit & kelola room",
    toneClass: "bg-status-free-bg text-status-free-text",
  },
  {
    icon: Users,
    label: "Teman gabung tanpa login",
    toneClass: "bg-status-tentative-bg text-status-tentative-text",
  },
] as const;

export function CreateRoomGate() {
  const { user, isLoading, signIn } = useAuth();
  const { showToast } = useToast();

  const handleSignIn = async () => {
    const signedIn = await signIn();
    if (signedIn) {
      showToast({
        title: "Berhasil Masuk",
        message: `Halo ${signedIn.displayName}, kamu sudah bisa membuat room jadwal.`,
        variant: "success",
      });
    } else {
      showToast({
        title: "Login Dibatalkan",
        message: "Masuk dengan Google diperlukan untuk membuat room jadwal.",
        variant: "warning",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6">
        <div className="wp-card h-64 animate-pulse bg-surface-card p-6" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <section aria-labelledby="buat-auth-title" className="wp-card grid gap-5 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2 border-border-ink bg-status-free-bg text-status-free-text shadow-[2px_2px_0_var(--border-ink)]"
            >
              <CalendarPlus className="h-6 w-6" />
            </span>
            <div className="grid gap-1">
              <h1 id="buat-auth-title" className="text-2xl font-extrabold text-text-primary">
                Masuk untuk Buat Room Jadwal
              </h1>
              <p className="text-sm text-text-secondary">
                Supaya room buatanmu tidak hilang dan tetap aman dikelola dari perangkat mana pun.
              </p>
            </div>
          </div>

          <ul className="grid gap-2.5 sm:grid-cols-3">
            {HOST_BENEFITS.map(({ icon: Icon, label, toneClass }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 rounded-xl border-2 border-border-ink bg-surface-canvas px-3 py-2.5 text-xs font-bold text-text-primary"
              >
                <span
                  aria-hidden="true"
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 border-border-ink ${toneClass}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <button
              type="button"
              onClick={handleSignIn}
              className="wp-btn wp-btn-primary min-h-12 flex-1"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span>Masuk dengan Google</span>
            </button>
            <Link href="/gabung" className="wp-btn wp-btn-secondary min-h-12">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>Gabung Pakai Kode</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
            Buat Jadwal Baru
          </h1>
          <p className="text-sm text-text-secondary">
            Tentukan pilihan tanggal, rentang jam, dan daftar teman sekelompokmu.
          </p>
        </div>

        <Link href="/gabung" className="wp-btn wp-btn-soft">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          <span>Punya Kode Room?</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <CreateRoomForm />
    </div>
  );
}
