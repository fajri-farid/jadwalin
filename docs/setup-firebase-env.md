# Panduan Setup Firebase & Variabel Lingkungan (`.env.local`)

Panduan ini menjelaskan cara membuat proyek Firebase gratis (_Spark Plan_) dan mendapatkan **4 nilai konfigurasi** yang diperlukan untuk mengaktifkan **Login Google** serta sinkronisasi **Cloud Firestore real-time** pada **Jadwalin**.

> **Mode Pengembangan Tanpa Firebase:** Jika keempat variabel `NEXT_PUBLIC_FIREBASE_*` dibiarkan kosong, Jadwalin otomatis berjalan dalam **Mode Mock Lokal** (`localStorage` di browser yang sama) sehingga Anda tetap bisa mencoba alur aplikasi dan menjalankan unit test secara lokal.

---

## 1. Variabel yang Dibutuhkan

Salin `.env.example` menjadi `.env.local` (atau `.env`), lalu isi keempat variabel berikut:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

| Variabel                           | Field di `firebaseConfig` | Peran di Aplikasi                                                          |
| ---------------------------------- | ------------------------- | -------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`     | `apiKey`                  | Mengizinkan SDK klien browser mengakses Firebase Auth dan Cloud Firestore. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain`              | Domain OAuth untuk popup **Masuk dengan Google**.                          |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  | `projectId`               | Menentukan database Cloud Firestore proyek yang dituju.                    |
| `NEXT_PUBLIC_FIREBASE_APP_ID`      | `appId`                   | Identitas aplikasi web spesifik di dalam proyek Firebase.                  |

_(Nilai lain pada snippet bawaan Firebase seperti `storageBucket`, `messagingSenderId`, dan `measurementId` tidak dipakai pada `v0.1.0`, sehingga tidak perlu dimasukkan ke `.env.local`.)_

---

## 2. Langkah Mendapatkan Keempat Nilainya

> **Sudah punya proyek Firebase?** Jika Anda sudah membuat proyek Firebase untuk Jadwalin (dan sudah mendaftarkan Web App), keempat info yang dibutuhkan untuk `.env.local` **sebenarnya sudah tersedia**. Anda tidak perlu membuat proyek ulang — cukup buka **Project settings** (ikon gerigi) → tab **General** → gulir ke bagian **Your apps** → pilih opsi **Config**, lalu salin & sesuaikan 4 nilainya ke `.env.local` (atau `.env`). _(Disarankan tetap memakai 1 proyek Firebase tersendiri khusus untuk Jadwalin agar data Firestore, pengguna, dan `firestore.rules` tidak tercampur dengan proyek lain.)_

### Langkah 1 — Buat Proyek Firebase Baru _(lewati jika sudah punya)_

1. Buka **Firebase Console**: `https://console.firebase.google.com/`
2. Klik **Create a project** (atau **Add project**), lalu beri nama proyek (mis. `jadwalin-app`).
3. Bagian **Google Analytics** boleh dimatikan (_Disable_), lalu klik **Create project**.

### Langkah 2 — Ambil 4 Nilai Config dari Web App

1. **Jika belum ada Web App di proyek:** di halaman beranda proyek (**Project Overview**), klik ikon **Web (`</>`)** (atau **Add app → Web**), masukkan nama panggilan aplikasi (mis. `jadwalin-web`), tidak perlu mencentang Firebase Hosting, lalu klik **Register app**.
2. **Jika Web App sudah ada:** buka **Project settings** (ikon gerigi) → tab **General** → bagian **Your apps** → pilih aplikasi web Anda → pilih radio **Config** untuk melihat blok `firebaseConfig`.
3. Dari blok `const firebaseConfig = { ... }`, salin dan sesuaikan **4 nilai** ini ke `.env.local`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY=`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID=`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID=`

### Langkah 3 — Aktifkan Login Google (Firebase Authentication)

1. Di menu kiri Firebase Console, buka **Build → Authentication**.
2. Klik **Get started**, lalu pilih tab **Sign-in method**.
3. Pilih **Google**, aktifkan toggle **Enable**, pilih **Project support email**, lalu klik **Save**.
4. Pada tab **Settings → Authorized domains**, `localhost` sudah otomatis diizinkan untuk pengembangan lokal. Jika nanti di-deploy ke Vercel atau domain khusus, tambahkan domain produksi Anda ke daftar ini.

### Langkah 4 — Buat Cloud Firestore & Pasang `firestore.rules`

1. Di menu kiri, buka **Build → Firestore Database** → klik **Create database** (pastikan menggunakan database **`(default)`**).
2. Pilih lokasi server terdekat (misalnya `asia-southeast2` untuk Jakarta atau `asia-southeast1` untuk Singapore).
3. Pilih mode awal (boleh _Production mode_), lalu klik **Create**.
4. Buka tab **Rules** pada halaman Firestore Database, salin seluruh isi file `firestore.rules` dari root repositori ini ke editor **Rules**, lalu klik **Publish**. _(Langkah ini wajib dilakukan agar tidak muncul error `403 PERMISSION_DENIED` dari aturan bawaan Production mode.)_

---

## 3. Verifikasi Koneksi

1. Pastikan `.env.local` menyimpan keempat nilai tanpa tanda kutip berlebih atau spasi di akhir baris.
2. Jalankan ulang server pengembangan:
   ```bash
   pnpm dev
   ```
3. Buka `http://localhost:3000/buat` lalu klik **Masuk dengan Google** — popup akun Google asli akan muncul (bukan akun demo lokal).
4. Setelah membuat room, buka jendela _Incognito_ atau browser berbeda ke `http://localhost:3000/gabung` dan masukkan kode 6 digit room tersebut untuk memastikan data terbaca dari Cloud Firestore.

> **Keamanan:** File `.env` dan `.env.local` otomatis diabaikan oleh `.gitignore`. Jangan pernah menempelkan nilai proyek pribadi Anda ke `.env.example` atau meng-commit file `.env*` selain `.env.example`.
