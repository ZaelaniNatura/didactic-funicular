# Website Showcase Recorder

Bikin video scroll website yang tajam dan mulus, tanpa screen record HP.

## Cara 1: GitHub Actions (bisa dari HP, tanpa install apa-apa)

Syarat: website lu sudah online (bukan localhost).

1. Bikin repo baru di GitHub, upload semua isi folder ini (termasuk folder `.github`).
2. Buka tab **Actions** → pilih **Record website showcase** → **Run workflow**.
3. Isi URL website, pilih `desktop` / `mobile` / `both`, lalu **Run workflow**.
4. Tunggu 2-4 menit. Buka run yang selesai → bagian **Artifacts** → download `showcase-videos`.

## Cara 2: Terminal di laptop/PC

Butuh Node.js 18+.

```bash
npm install
npx playwright install chromium

node record.mjs https://websitelu.com             # desktop 1920x1080
node record.mjs https://websitelu.com --mobile    # tampilan HP
node record.mjs https://websitelu.com --seconds=20 --fps=60 --out=hasil/demo.mp4
```

Website yang masih jalan di localhost juga bisa:

```bash
node record.mjs http://localhost:3000
```

## Opsi

| Opsi | Default | Keterangan |
|---|---|---|
| `--mobile` | off | Tampilan HP 390x844 (retina 2x) |
| `--seconds` | 14 | Durasi bagian scroll |
| `--fps` | 30 | 30 atau 60 |
| `--width` / `--height` | 1920 / 1080 | Ukuran viewport desktop |
| `--out` | showcase-*.mp4 | Nama file hasil |

## Catatan

- Video dirender per frame, jadi hasilnya selalu mulus walau komputer lemot.
- Website yang pakai smooth-scroll library (Lenis, Locomotive) kadang tidak ikut
  scroll persis; coba perpanjang `--seconds` atau kabari untuk disesuaikan.
- Popup cookie/banner ikut terekam. Tutup lewat setting situs atau edit `record.mjs`.
