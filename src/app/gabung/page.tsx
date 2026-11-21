import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { JoinByCodeCard } from "@/components/room/join-by-code-card";

export const metadata: Metadata = {
  title: "Gabung Kode Room",
  description: "Masukkan 6 angka kode room untuk langsung mengisi jadwal bersama kelompok.",
};

export default function JoinRoomPage() {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
          Gabung ke Room Jadwal
        </h1>
        <p className="text-sm text-text-secondary">
          Minta 6 angka kode room ke pembuat jadwal atau cek lagi di grup chat kalian.
        </p>
      </div>

      <JoinByCodeCard />

      <div className="wp-card-muted flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="text-sm font-medium text-text-secondary">
          Mau bikin room baru untuk kelompokmu?
        </span>
        <Link href="/buat" className="wp-btn wp-btn-secondary">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />
          <span>Buat Room</span>
        </Link>
      </div>
    </div>
  );
}
