# Kebijakan Keamanan (Security Policy)

## Versi yang Didukung

| Versi   | Status Dukungan |
| ------- | --------------- |
| `0.1.x` | Didukung aktif  |

## Arsitektur Keamanan Singkat (`v0.1.0`)

- **Variabel `NEXT_PUBLIC_FIREBASE_*`:** Nilai konfigurasi Firebase Web SDK memang dirancang bersifat publik oleh Firebase; pembatasan akses baca dan tulis Cloud Firestore ditegakkan di sisi server oleh [`firestore.rules`](firestore.rules).
- **Kredensial Privat:** Tidak ada secret key server atau Firebase Admin SDK di repositori maupun sisi klien. Jangan pernah menyertakan `.env` / `.env.local` berisi kredensial sensitif di Pull Request.
- **PIN Opsional Peserta:** PIN 4 angka opsional untuk melindungi identitas roster dihitung dan disimpan dalam bentuk hash **SHA-256** (`src/lib/security/pin.ts`), bukan teks polos.

## Melaporkan Celah Keamanan

Jika Anda menemukan potensi kerentanan keamanan (misalnya bypass pada `firestore.rules`, kebocoran kredensial, atau celah XSS):

1. **Jangan** membuat GitHub Issue publik yang memaparkan detail eksploitasi.
2. Laporkan melalui tab **Security → Advisories → Report a vulnerability** di repositori GitHub proyek ini, atau hubungi pengelola (`fajrijry14@gmail.com`) dengan subjek `[SECURITY] Jadwalin: <ringkasan singkat>`.
3. Sertakan langkah reproduksi minimal dan perkiraan dampaknya agar tim dapat segera meninjau dan merilis perbaikan.
