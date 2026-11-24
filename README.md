# Berkah Telur Jaya (BTJ)

Aplikasi web kasir, stok peti, dan laporan harian untuk operasional agen/toko telur **Berkah Telur Jaya** (Jl. Letnan Sukarna, Kp. Gedong, Ciampea, Bogor). Dibuat untuk menggantikan pencatatan manual di buku supaya stok, pengeluaran uang laci, telur pecah/retak, dan laba rugi harian lebih gampang dipantau dari HP maupun laptop.

**Live Demo:** https://berkah-telur-jaya.vercel.app/

## Coba Langsung (Mode Demo)

Aplikasi otomatis berjalan dalam **Mode Demo Lokal** jika environment variable Supabase belum diisi. Buka `/login` lalu klik tombol **Demo Kasir / Staff** atau **Demo Owner**, atau login manual dengan akun berikut:

| Role | Nama | Email | Password | Akses |
| :--- | :--- | :--- | :--- | :--- |
| Owner | Pak Budi Santoso | `owner@berkahtelurjaya.demo` | `demo1234` | Semua menu, dashboard profit, update harga harian, export Excel |
| Staff / Kasir | Lala | `staff@berkahtelurjaya.demo` | `demo1234` | Kasir, pantau stok & kiriman mobil, kas keluar, tutup kasir |

## Fitur

- **Kasir (`/`)**: Input transaksi per kiloan (`1/4 kg`, `1/2 kg`, `1 kg`, `2 kg`, `1 tray`, `1 peti`) maupun nominal rupiah (`Rp 10rb` - `Rp 50rb` dengan konversi berat otomatis), mode **Telur Retak** (diskon cepat), pembayaran Tunai/QRIS/Transfer, dan tombol kirim nota ke WhatsApp.
- **Stok & Kiriman Mobil (`/stok`)**: Pantau sisa stok dalam `kg` dan estimasi `peti`, alert stok menipis dengan tombol pesan WhatsApp ke gudang, catat penerimaan kiriman mobil, dan catat telur pecah/busuk.
- **Kas Keluar (`/kas-keluar`)**: Catat pengeluaran harian dari uang laci (plastik, parkir, konsumsi, dll.) supaya hitungan uang fisik saat tutup kasir sesuai.
- **Dashboard Owner (`/dashboard`)**: Ringkasan omzet, profit bersih, kas keluar, kerugian pecah hari ini, grafik 7 hari terakhir, dan update harga modal/jual harian.
- **Laporan & Tutup Kasir (`/laporan`)**: Cocokkan uang fisik di laci terhadap kas seharusnya (`tunai masuk - kas keluar`), filter riwayat transaksi, dan **Export Excel (`.xlsx`)** dengan kop laporan, format Rupiah, dan baris total otomatis.
- **PWA**: Bisa dipasang ke layar utama HP (*Add to Home Screen*) langsung dari browser.

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS v4
- **Backend & Database:** Supabase (PostgreSQL, Auth, Row Level Security, trigger stok otomatis)
- **Export:** ExcelJS (`.xlsx`)
- **Deployment:** Vercel

## Menjalankan di Lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. Tanpa file `.env.local`, aplikasi langsung berjalan di Mode Demo Lokal.

### Setup Supabase (Opsional untuk Produksi)

1. Salin `.env.example` menjadi `.env.local` dan isi `NEXT_PUBLIC_SUPABASE_URL` serta `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Jalankan [`supabase/schema.sql`](supabase/schema.sql) di SQL Editor Supabase untuk membuat 8 tabel (`profiles`, `egg_types`, `sales`, `sale_items`, `restock_deliveries`, `stock_losses`, `expenses`, `daily_closings`), trigger stok, dan policy RLS.
3. *(Opsional)* Jalankan [`supabase/seed.sql`](supabase/seed.sql) untuk mengisi data contoh 7 hari dan akun demo.
4. Restart `npm run dev`.
