# Jadwalin

<p align="center">
  <img src="src/app/icon.svg" alt="Logo Jadwalin" width="96" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versi-0.1.0-4F46E5?style=flat-square" alt="Versi 0.1.0" />
  <img src="https://img.shields.io/badge/Next.js-16.4.6-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16.4.6" />
  <img src="https://img.shields.io/badge/React-19.3.0-149ECA?style=flat-square&logo=react&logoColor=white" alt="React 19.3.0" />
  <img src="https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.9.3" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.3.3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4.3.3" />
  <img src="https://img.shields.io/badge/Firebase-13.4.0-DD2C00?style=flat-square&logo=firebase&logoColor=white" alt="Firebase 13.4.0" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/lisensi-MIT-16A34A?style=flat-square" alt="Lisensi MIT" /></a>
</p>

<p align="center"><strong>Cari waktu kumpul bareng, tanpa ribet di grup chat.</strong></p>

Jadwalin membantu kelompok belajar, tim kerja, organisasi, dan teman tongkrongan menemukan jam yang cocok untuk semua orang. Buat room, bagikan kode 6 angka ke grup, lalu lihat jam mana yang paling banyak anggotanya bisa hadir.

Pembuat room masuk dengan akun Google. Anggota lain cukup membuka link atau memasukkan kode, memilih namanya, lalu menandai jam luang — tanpa perlu membuat akun atau memasang aplikasi.

[Fitur](#fitur) · [Cara pakai](#cara-pakai) · [Menjalankan secara lokal](#menjalankan-secara-lokal) · [Deploy](#deploy-ke-vercel) · [Kontribusi](#kontribusi)

## Fitur

- **Gabung dengan kode 6 angka.** Anggota masuk lewat link atau kode, lalu memilih namanya dari daftar anggota yang sudah disiapkan pembuat room.
- **Dua pilihan ketersediaan.** Tandai jam sebagai **Bisa** atau **Diusahakan (50:50)** untuk jam yang masih bisa disesuaikan.
- **Nyaman dipakai di HP.** Pilih banyak slot sekaligus dengan menggeser jari, dan gulir halaman lewat kolom jam tanpa salah menandai slot.
- **Rentang 24 jam.** Slot tersedia dari 00:00 sampai 24:00 dengan interval 30 menit.
- **Rekomendasi waktu terbaik.** Hasil diperbarui langsung saat anggota mengisi, lengkap dengan daftar siapa yang sudah dan belum mengisi.
- **Kunci jadwal.** Setelah sepakat, pembuat room dapat mengunci jam final dan menutup pengisian. Room dapat dibuka kembali bila diperlukan.
- **Pengumuman WhatsApp siap kirim.** Salin pesan ajakan mengisi jadwal atau pengumuman jadwal final ke grup.
- **Jadwal Rutinku.** Pengguna yang masuk dengan Google dapat menyimpan jam luang mingguan dan menerapkannya ke room baru dengan satu klik.
- **Dashboard.** Lihat room yang pernah dibuat atau diikuti, lengkap dengan pencarian dan filter.
- **PIN opsional.** Anggota tanpa akun dapat memasang PIN 4 angka agar isiannya tidak diubah orang lain.

Satu room mendukung hingga **31 tanggal atau hari**.

## Cara pakai

1. **Buat room.** Masuk dengan Google, isi judul dan deskripsi, pilih tanggal tertentu atau hari dalam seminggu, lalu tulis daftar nama anggota.
2. **Bagikan ke grup.** Kirim link atau kode 6 angka. Anggota memilih namanya, lalu menandai jam **Bisa** atau **Diusahakan (50:50)**.
3. **Tentukan jadwal.** Periksa rekomendasi waktu terbaik, kunci jam yang disepakati, lalu salin pengumumannya ke WhatsApp.

## Menjalankan secara lokal

### Kebutuhan

- **Node.js 20 atau lebih baru** (disarankan Node.js 22 LTS).
- **pnpm 12.10.1**.
- **Project Firebase** (paket gratis Spark) untuk login Google dan penyimpanan data. Opsional saat hanya mencoba di komputer sendiri.

### 1. Pasang dependency

```bash
pnpm install --frozen-lockfile
```

### 2. Siapkan konfigurasi

Salin [.env.example](.env.example) menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Jika memakai PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Isi empat variabel `NEXT_PUBLIC_FIREBASE_*` mengikuti [panduan setup Firebase](docs/setup-firebase-env.md), lalu terapkan isi [firestore.rules](firestore.rules) di Firebase Console.

> **Mencoba tanpa Firebase?** Biarkan keempat variabel kosong. Aplikasi tetap berjalan dengan menyimpan data di browser, sehingga semua alur bisa dicoba di satu perangkat.

### 3. Jalankan aplikasi

```bash
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Deploy ke Vercel

1. Hubungkan repository ini ke [Vercel](https://vercel.com/new).
2. Tambahkan empat variabel `NEXT_PUBLIC_FIREBASE_*` di **Settings → Environment Variables**.
3. Jalankan deploy.
4. Tambahkan domain Vercel ke **Firebase Console → Authentication → Settings → Authorized domains** agar login Google berfungsi.

## Teknologi

| Teknologi               | Kegunaan                                   |
| ----------------------- | ------------------------------------------ |
| Next.js dan React       | Halaman dan alur aplikasi                  |
| TypeScript              | Pemeriksaan tipe data                      |
| Tailwind CSS dan Lucide | Tampilan dan ikon                          |
| Firebase Authentication | Login dengan Google                        |
| Cloud Firestore         | Penyimpanan dan sinkronisasi data langsung |
| Zod dan Vitest          | Validasi data dan pengujian                |

Perhitungan rekomendasi waktu dan pembuatan pesan WhatsApp dijalankan sepenuhnya oleh kode aplikasi, tanpa layanan AI.

## Perintah

| Perintah            | Kegunaan                               |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Menjalankan aplikasi saat pengembangan |
| `pnpm lint`         | Memeriksa aturan penulisan kode        |
| `pnpm typecheck`    | Memeriksa tipe data                    |
| `pnpm format:check` | Memeriksa format kode                  |
| `pnpm test`         | Menjalankan seluruh test               |
| `pnpm build`        | Membuat build produksi                 |
| `pnpm start`        | Menjalankan hasil build produksi       |

Test berjalan tanpa koneksi ke Firebase.

## Struktur proyek

| Lokasi                  | Isi                                                       |
| ----------------------- | --------------------------------------------------------- |
| `src/app/`              | Halaman aplikasi                                          |
| `src/components/`       | Komponen tampilan                                         |
| `src/lib/engine/`       | Perhitungan slot, rekomendasi, jadwal rutin, dan pesan WA |
| `src/lib/repositories/` | Akses data Firestore dan penyimpanan lokal                |
| `src/lib/firebase/`     | Konfigurasi Firebase dan login Google                     |
| `firestore.rules`       | Aturan keamanan database                                  |
| `docs/`                 | Panduan setup                                             |

## Data dan privasi

- Siapa pun yang memiliki link atau kode room dapat melihat judul room, daftar nama anggota, dan jam yang ditandai. Jangan menulis informasi pribadi atau sensitif di judul, deskripsi, maupun nama anggota.
- PIN tidak disimpan dalam bentuk aslinya. Yang disimpan hanya hasil hash.
- Hanya pembuat room yang dapat mengubah pengaturan room, mengunci jadwal, atau menghapus room.
- Data Jadwal Rutinku hanya dapat diakses oleh pemilik akunnya.
- Nilai `NEXT_PUBLIC_FIREBASE_*` memang bersifat publik. Akses data dibatasi oleh [firestore.rules](firestore.rules).

## Kontribusi

Menemukan bug atau punya usulan? Buat issue melalui tab **Issues**. Untuk perubahan kode, baca [CONTRIBUTING.md](CONTRIBUTING.md) terlebih dahulu.

Sebelum mengajukan pull request, pastikan `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, dan `pnpm build` berhasil. Jangan menyertakan kredensial, file `.env`, atau data pribadi.

Untuk melaporkan celah keamanan, ikuti [kebijakan keamanan](SECURITY.md). Seluruh kontributor diharapkan mematuhi [kode etik](CODE_OF_CONDUCT.md).

## Lisensi

Dirilis dengan [lisensi MIT](LICENSE).
