# REFFMARINE — starter aplikasi online

Fondasi awal aplikasi manajemen distribusi ikan beku: React + Vite, Supabase Auth/Postgres, dan Cloudflare Pages.

## Status paket
Ini adalah **starter MVP**, belum menjadi sistem produksi penuh dan belum dipublikasikan ke internet. Dashboard, login Supabase, daftar produk, daftar batch/freezer, dan penambahan master jenis ikan/freezer sudah disiapkan. Modul pembelian, POS, piutang, laporan, barcode kamera, serta alur stok atomik masih perlu diselesaikan sebelum dipakai untuk transaksi riil.

## Stack gratis
- Cloudflare Pages: hosting frontend dan subdomain `*.pages.dev`. Batas gratis saat ini mencakup 500 builds/bulan dan 20.000 file per site.
- Supabase Free: PostgreSQL dan autentikasi; batas termasuk 500 MB database. Proyek gratis dapat dijeda setelah 1 minggu tidak aktif dan tidak menyertakan backup otomatis.
- Tidak memakai Vercel Hobby karena paket tersebut dibatasi untuk penggunaan personal/non-komersial.

## Menjalankan di komputer
1. Install Node.js versi LTS.
2. Ekstrak folder ini.
3. Jalankan `npm install`.
4. Salin `.env.example` menjadi `.env.local`.
5. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari Supabase Project Settings > API.
6. Di Supabase SQL Editor, jalankan seluruh `supabase/schema.sql`.
7. Jalankan `npm run dev`.

## Menyiapkan akun Admin
1. Buat akun pertama melalui Supabase Dashboard > Authentication > Users > Add user.
2. Salin UUID user tersebut.
3. Jalankan SQL: `update public.profiles set role='admin', full_name='Admin REFFMARINE' where id='UUID-USER';`
4. Login melalui aplikasi.
5. Admin dapat membuat akun karyawan melalui Supabase Auth Dashboard; profil otomatis dibuat sebagai employee.

## Deploy Cloudflare Pages
1. Buat akun Cloudflare dan repository GitHub pribadi.
2. Upload/push isi folder proyek ke repository.
3. Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git.
4. Build command: `npm run build`; output directory: `dist`.
5. Tambahkan environment variables `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` pada Pages project, lalu deploy.
6. Gunakan subdomain `nama-project.pages.dev`.

## Keamanan
- Frontend hanya boleh menggunakan Supabase anon/publishable key.
- Jangan pernah menaruh `service_role` key dalam `.env` frontend, GitHub, atau file yang dibagikan.
- Aktifkan verifikasi email dan gunakan password kuat.
- Batasi pembuatan akun oleh Admin; jangan membuka pendaftaran publik.
- Kebijakan RLS pada schema adalah fondasi awal; audit dan uji akses wajib dilakukan sebelum operasional.
- Paket gratis Supabase tidak menyediakan backup otomatis. Lakukan ekspor database berkala dan simpan di tempat aman.

## Ketentuan bisnis yang sudah dimasukkan ke rancangan
- Satu gudang pusat, beberapa freezer.
- Stok berdasarkan produk, batch, dan lokasi freezer.
- Harga jual aktif di master produk; setiap item penjualan menyimpan `unit_price_snapshot` agar transaksi lama tidak berubah saat harga master diperbarui.
- Pembayaran: cash, transfer, credit/tempo.
- Data supplier nelayan dan pelanggan.
