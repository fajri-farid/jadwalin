export interface ChatBubbleExample {
  id: string;
  sender: string;
  time: string;
  text: string;
}

export interface BentoFeatureItem {
  id: "roster" | "paint-grid" | "routine" | "wa-draft";
  badge: string;
  title: string;
  description: string;
}

export interface HowItWorksStep {
  step: "01" | "02" | "03";
  title: string;
  description: string;
  pill: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const HERO_CONTENT = {
  eyebrow: "Gratis · Tanpa Iklan · Ramah HP",
  headline: "Atur jadwal kumpul & rapat kelompok dalam 30 detik.",
  headlineWords: ["Atur", "jadwal", "kumpul", "&", "rapat", "kelompok", "dalam"] as const,
  headlineHighlight: "30 detik.",
  subheadline:
    'Nggak perlu tanya "kalian kosong kapan?" satu-satu. Masuk pakai kode 6 angka, tandai jam Bisa atau 50:50 dengan nyaman di HP, lalu salin hasilnya ke WhatsApp.',
  primaryCta: "Buat Room Jadwal",
  secondaryCta: "Jadwal Rutinku",
  quickBadges: ["Teman masuk tanpa login", "Ada opsi 50:50", "Sinkron real-time"],
} as const;

export const HERO_LIVE_PREVIEW = {
  roomTitle: "Rapat Kelompok Bab 3",
  roomCodeDisplay: "482 910",
  dateLabel: "Sel, 24 Nov",
  timeRange: "19:00 – 21:00",
  durationLabel: "2 jam",
  freeMembers: ["Fajri", "Citra", "Andi"],
  tentativeMembers: ["Budi"],
  totalMembers: 4,
} as const;

export const BEFORE_CHAT_MESSAGES: readonly ChatBubbleExample[] = [
  {
    id: "chat-1",
    sender: "Andi",
    time: "19.04",
    text: "Aku bisanya Rabu habis Ashar aja deh",
  },
  {
    id: "chat-2",
    sender: "Citra",
    time: "19.12",
    text: "Eh Rabu jam 4 aku ada praktikum di lab",
  },
  {
    id: "chat-3",
    sender: "Budi",
    time: "19.45",
    text: "Jadi kumpul kapan nih? Chatnya ketumpuk lagi...",
  },
] as const;

export const AFTER_BEST_WINDOW_PREVIEW = {
  rank: "#1",
  dayLabel: "Sel, 24 Nov",
  timeRange: "19:00 - 21:00",
  durationLabel: "2 jam",
  statusBadge: "Semua bisa (4/4)",
  attendees: ["Fajri", "Citra", "Andi", "Budi"],
  waSnippet:
    "Halo semuanya! Jadwal *Rapat Kelompok Bab 3* sudah fix ya: *Selasa, 24 November · 19:00 - 21:00*",
} as const;

export const BENTO_FEATURES: readonly BentoFeatureItem[] = [
  {
    id: "roster",
    badge: "Absen Otomatis",
    title: "Ketahuan Siapa yang Belum Isi",
    description:
      "Masukkan daftar nama kelompok saat membuat room. Teman tinggal klik namanya sendiri—nggak perlu daftar akun atau bingung nama ganda.",
  },
  {
    id: "paint-grid",
    badge: "Anti Salah Pencet di HP",
    title: "Scroll Aman & Opsi 50:50",
    description:
      "Geser dari kolom jam untuk menggulir layar dengan mulus, usap kotak untuk menandai Bisa atau Diusahakan 50:50, sambil melihat jam yang dipilih teman.",
  },
  {
    id: "routine",
    badge: "Hemat Waktu 1-Klik",
    title: "Jadwal Rutinku Mingguan",
    description:
      "Punya jam kuliah, kerja, atau kegiatan rutin 24 jam yang berulang tiap minggu? Simpan sekali di akun Google-mu, lalu terapkan otomatis ke room baru.",
  },
  {
    id: "wa-draft",
    badge: "Siap Kirim ke Grup",
    title: "Kunci Jadwal & Draf Pengumuman WA",
    description:
      "Begitu mayoritas sepakat, kunci jadwal final agar room tidak berubah lagi dan salin pengumuman rapi siap tempel ke grup WhatsApp.",
  },
] as const;

export const HOW_IT_WORKS_STEPS: readonly HowItWorksStep[] = [
  {
    step: "01",
    title: "Buat Room & Bagi Kode 6 Angka",
    description:
      "Pilih tanggal spesifik atau hari mingguan, isi deskripsi singkat, dan tambahkan daftar nama anggota kelompokmu.",
    pill: "Kode 6 Digit",
  },
  {
    step: "02",
    title: "Teman Klik Nama & Usap Jam",
    description:
      "Teman membuka link dari WhatsApp tanpa wajib login, mengklaim namanya, lalu menandai slot Bisa atau 50:50.",
    pill: "Tanpa Wajib Login",
  },
  {
    step: "03",
    title: "Kunci Jadwal & Kirim ke WA",
    description:
      "Lihat rekomendasi waktu terbaik secara real-time, kunci jam kesepakatan, dan salin pesan pengumuman grup.",
    pill: "1-Klik Salin WA",
  },
] as const;

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "no-login-required",
    question: "Apakah teman satu kelompok harus bikin akun untuk mengisi jadwal?",
    answer:
      "Nggak perlu. Cukup bagikan kode room 6 angka atau link dari grup WhatsApp. Temanmu tinggal pilih namanya di daftar anggota lalu langsung menandai jam yang tersedia, dan bisa pasang PIN 4 angka opsional kalau mau.",
  },
  {
    id: "free-vs-tentative",
    question: "Apa bedanya pilihan Bisa dan Diusahakan (50:50)?",
    answer:
      "Pilih Bisa untuk jam yang memang kamu kosong penuh, dan pilih Diusahakan (50:50) untuk jam yang masih bisa digeser kalau mayoritas cocok. Jadwalin tetap memprioritaskan jam dengan peserta Bisa terbanyak lebih dulu.",
  },
  {
    id: "full-24-hours",
    question: "Jam berapa saja yang bisa dipilih di dalam grid jadwal?",
    answer:
      "Penuh 24 jam dengan interval per 30 menit, dari pukul 00:00 sampai 24:00. Mau atur rapat pagi, nongkrong sore, diskusi malam, atau sesi begadang akhir pekan semuanya bisa ditandai tanpa terpotong.",
  },
  {
    id: "lock-and-wa-draft",
    question: "Bagaimana cara biar jadwal tidak berubah lagi setelah semua sepakat?",
    answer:
      "Pembuat room bisa menekan Kunci Jadwal & Tutup Room lalu memilih jam final yang disepakati. Pengisian anggota otomatis ditutup, draf pengumuman WhatsApp langsung berubah menjadi pengumuman jadwal fix, dan room masih bisa dibuka kembali jika ada perubahan mendadak.",
  },
  {
    id: "routine-and-dashboard",
    question: "Untuk apa login Google kalau teman bisa masuk tanpa akun?",
    answer:
      "Login Google dipakai oleh pembuat room atau siapa pun yang ingin menyimpan riwayat room di Dashboard dan mengatur template Jadwal Rutinku mingguan, sehingga jam kosong rutinmu bisa langsung diterapkan dalam 1 klik di room baru.",
  },
  {
    id: "free-and-open-source",
    question: "Apakah Jadwalin gratis dan bebas iklan?",
    answer:
      "Ya, Jadwalin sepenuhnya gratis, tanpa iklan, dan dibangun secara open-source untuk kebutuhan kelompok belajar, organisasi kampus, komunitas, hingga kumpul bareng teman.",
  },
] as const;
