# Panduan Kontribusi (Contributing)

Terima kasih sudah tertarik ikut membangun **Jadwalin**! Proyek ini berlisensi **MIT** dan terbuka bagi siapa saja yang ingin memperbaiki bug, menambah test, meningkatkan aksesibilitas, maupun mengusulkan fitur baru.

---

## 1. Memulai Pengembangan Lokal

1. **Fork** repositori ini lalu buat branch baru dari `main`:
   ```bash
   git checkout -b feat/nama-fitur-singkat
   ```
2. Pasang dependensi menggunakan `pnpm`:
   ```bash
   pnpm install
   ```
3. Jalankan server pengembangan (`Mode Mock Lokal` aktif otomatis bila `.env.local` belum diisi):
   ```bash
   pnpm dev
   ```
   Jika ingin menguji sinkronisasi live Firebase, ikuti panduan di [docs/setup-firebase-env.md](docs/setup-firebase-env.md).

---

## 2. Prinsip Desain & Arsitektur

Sebelum mengirim Pull Request, pastikan perubahan Anda menjaga standar proyek berikut:

- **Mobile-First & Ramah Sentuh:** Pastikan target sentuh nyaman di layar HP (`>= 44px` di pointer sentuh), jangan sampai gestur _scroll_ bentrok dengan interaksi grid/komponen, dan hindari teks instruksi panjang yang sudah jelas secara visual.
- **Konsistensi Design System & Ikon:**
  - Gunakan utilitas & token warna di `src/app/globals.css` (**Tailwind CSS v4** `@theme inline`, tema _Warm Playful Pop_).
  - Seluruh ikon UI wajib memakai **`lucide-react`** — **jangan** menggunakan emoji sebagai ikon antarmuka.
  - Gunakan Bahasa Indonesia yang alami dan ringkas untuk seluruh label, tombol, pesan error, dan toast pengguna (hindari jargon teknis seperti "subkoleksi", "hash", atau "validasi" pada teks UI).
- **Keamanan:**
  - Jangan pernah menaruh kredensial privat, token aktif, atau kunci server ke variabel `NEXT_PUBLIC_*` atau komponen `"use client"`.
  - Pastikan perubahan data Firestore tetap selaras dengan validasi skema di `src/lib/repositories/validation.ts` dan [`firestore.rules`](firestore.rules).
  - Hormati preferensi aksesibilitas (`prefers-reduced-motion`, semantik HTML `<dialog>`, `<details>`, fokus keyboard, serta kontras warna minimal `>= 4.5:1`).

---

## 3. Aturan Pesan Commit (`commitlint` + Husky)

Repositori ini memakai **Conventional Commits** berbahasa Indonesia yang divalidasi otomatis oleh Husky (`commit-msg`) sesuai [`commitlint.config.mjs`](commitlint.config.mjs):

- **Format:** `<type>(<scope-opsional>): <subject>`
- **`type` yang diizinkan (lowercase):** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`
- **`scope` (opsional):** lowercase (contoh: `grid`, `room`, `landing`, `dashboard`, `firebase`)
- **`subject`:** diawali huruf kecil (kata kerja imperatif Bahasa Indonesia), tanpa tanda titik di akhir, panjang header maksimal `150` karakter.

Contoh pesan commit yang valid:

```text
feat(grid): tambah pintasan bersihkan semua slot di layar mobile
fix(room): cegah perubahan jadwal ketika status room sudah ditutup
docs: perbarui panduan setup firestore rules di readme
test(engine): tambah skenario rentang jam lintas tengah malam
```

---

## 4. Pemeriksaan Wajib Sebelum Membuka PR

Hook `pre-commit` (`lint-staged`) dan `pre-push` (`typecheck` & `test`) berjalan otomatis, dan GitHub Actions CI juga memverifikasi seluruh daftar berikut:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Pastikan semua perintah di atas lulus tanpa error dan tanpa warning sebelum mengirim Pull Request. Terima kasih atas kontribusi Anda!
