import type { Metadata } from "next";
import { CreateRoomGate } from "@/components/room/create-room-gate";

export const metadata: Metadata = {
  title: "Buat Room Jadwal",
  description:
    "Masuk dengan Google lalu buat room penjadwalan lengkap dengan kode 6 angka dan roster kelompok.",
};

export default function CreateRoomPage() {
  return <CreateRoomGate />;
}
