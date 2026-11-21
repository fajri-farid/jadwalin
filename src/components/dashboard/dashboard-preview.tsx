"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarPlus, KeyRound, LayoutGrid, LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useToast } from "@/components/ui/toast-provider";
import { getScheduleRepository } from "@/lib/repositories/schedule-repository";
import { formatRoomCodeDisplay } from "@/lib/utils/room-code";
import type { UserEventSummary } from "@/types/schedule";

export function DashboardPreview() {
  const { user, isLoading, signIn } = useAuth();
  const { showToast } = useToast();
  const [loadedProfile, setLoadedProfile] = useState<{
    uid: string;
    events: UserEventSummary[];
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      return;
    }

    const currentUid = user.uid;
    void getScheduleRepository()
      .getUserProfile(currentUid)
      .then((profile) => {
        if (active) {
          setLoadedProfile({
            uid: currentUid,
            events: profile?.recentEventSlugs ?? [],
          });
        }
      })
      .catch(() => {
        if (active) {
          setLoadedProfile({ uid: currentUid, events: [] });
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const recentEvents = user && loadedProfile?.uid === user.uid ? loadedProfile.events : [];

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

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-8 sm:px-6">
        <div className="wp-card h-40 animate-pulse bg-surface-card p-6" />
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
            Masuk untuk Kelola Room &amp; Riwayat
          </h1>
          <p className="mx-auto text-sm text-text-secondary">
            Masuk dengan Google untuk membuat room baru, melihat riwayat room, dan menyimpan jadwal
            rutinmu. Kalau diundang teman, langsung gabung pakai kode 6 angka tanpa login.
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

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            Halo, {user.displayName}
          </h1>
          <p className="text-sm text-text-secondary">
            Daftar room jadwal yang pernah kamu buat atau ikuti dengan akun ini.
          </p>
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

      <section aria-label="Riwayat Room" className="wp-card grid gap-4 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-text-primary">Room Terbaru</h2>
        {recentEvents.length > 0 ? (
          <ul className="grid gap-3">
            {recentEvents.map((item) => (
              <li key={item.eventId}>
                <Link
                  href={`/r/${item.slug}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border-ink bg-surface-canvas p-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="grid gap-0.5">
                    <span className="font-bold text-text-primary">{item.title}</span>
                    <span className="font-mono text-xs text-text-muted">
                      Kode: {formatRoomCodeDisplay(item.roomCode)}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">
            Belum ada room tersimpan. Buat room pertamamu untuk mulai mencocokkan jadwal kelompok.
          </p>
        )}
      </section>
    </div>
  );
}
