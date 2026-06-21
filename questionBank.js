// ============================================================
// OOPify V3 — Question Bank
// Edit soal di sini sesuai kebutuhan riset.
// Setiap soal memiliki: id, difficulty, estimatedTime, title,
// description (HTML diperbolehkan untuk formatting), dan hints.
// ============================================================

export const QUESTION_BANK = [
  // ── SOAL 1: MUDAH ──────────────────────────────────────────
  {
    id: "q1",
    difficulty: "Mudah",
    difficultyColor: "#4ade80",
    estimatedTime: "10 menit",
    title: "Enkapsulasi — Class Mahasiswa",
    description: `Buatlah sebuah <strong>class</strong> bernama <code>Mahasiswa</code> yang merepresentasikan data seorang mahasiswa, dengan ketentuan berikut:

<b>Atribut:</b>
• <code>nim</code> — tipe <em>String</em>
• <code>nama</code> — tipe <em>String</em>
• <code>ipk</code> — tipe <em>double</em>

<b>Constructor:</b>
• Sebuah constructor yang menerima ketiga atribut di atas sebagai parameter.

<b>Method:</b>
• <code>tampilkanInfo()</code> — method bertipe <em>void</em> yang mencetak semua informasi mahasiswa ke konsol.

<b>Di Main Method:</b>
• Buat satu objek <code>Mahasiswa</code> dengan data bebas, lalu panggil <code>tampilkanInfo()</code>.`,
    hints: [
      "Mulai dengan blok Class, beri nama Mahasiswa",
      "Tambahkan 3 atribut menggunakan blok Variable",
      "Gunakan blok Constructor dan isi parameternya",
      "Gunakan blok Method untuk tampilkanInfo()",
      "Gunakan blok Print di dalam method tersebut",
    ],
  },

  // ── SOAL 2: MENENGAH ───────────────────────────────────────
  {
    id: "q2",
    difficulty: "Menengah",
    difficultyColor: "#fbbf24",
    estimatedTime: "15 menit",
    title: "Pewarisan (Inheritance) — Hierarki Hewan",
    description: `Buatlah sebuah hierarki class yang merepresentasikan dunia hewan menggunakan konsep <strong>inheritance</strong>:

<b>Class Induk — <code>Hewan</code>:</b>
• Atribut: <code>nama</code> (String), <code>umur</code> (int)
• Method: <code>bersuara()</code> — cetak teks bebas sebagai suara default.

<b>Class Turunan 1 — <code>Kucing</code> extends <code>Hewan</code>:</b>
• Atribut tambahan: <code>ras</code> (String)
• Override method <code>bersuara()</code> → cetak <em>"Meow!"</em>

<b>Class Turunan 2 — <code>Anjing</code> extends <code>Hewan</code>:</b>
• Atribut tambahan: <code>pemilik</code> (String)
• Override method <code>bersuara()</code> → cetak <em>"Woof!"</em>

<b>Di Main Method:</b>
• Buat satu objek <code>Kucing</code> dan satu objek <code>Anjing</code>, lalu panggil <code>bersuara()</code> pada keduanya.`,
    hints: [
      "Buat class Hewan terlebih dahulu",
      "Gunakan blok Extends untuk menghubungkan class turunan",
      "Override method bersuara() di masing-masing class turunan",
      "Gunakan blok New Object untuk membuat objek di main method",
    ],
  },

  // ── SOAL 3: SUSAH ──────────────────────────────────────────
  {
    id: "q3",
    difficulty: "Susah",
    difficultyColor: "#f87171",
    estimatedTime: "20 menit",
    title: "Interface & Polimorfisme — Sistem Bentuk",
    description: `Buatlah sebuah sistem perhitungan geometri menggunakan <strong>interface</strong> dan <strong>polymorphism</strong>:

<b>Interface — <code>Bentuk</code>:</b>
• Method abstrak: <code>hitungLuas()</code> bertipe <em>double</em>
• Method abstrak: <code>hitungKeliling()</code> bertipe <em>double</em>

<b>Class <code>Lingkaran</code> implements <code>Bentuk</code>:</b>
• Atribut: <code>jariJari</code> (double)
• Implementasikan kedua method dari interface.

<b>Class <code>Persegi</code> implements <code>Bentuk</code>:</b>
• Atribut: <code>sisi</code> (double)
• Implementasikan kedua method dari interface.

<b>Class <code>Segitiga</code> implements <code>Bentuk</code>:</b>
• Atribut: <code>alas</code> (double), <code>tinggi</code> (double)
• Implementasikan kedua method dari interface.

<b>Di Main Method:</b>
• Buat satu objek dari masing-masing class, lalu panggil <code>hitungLuas()</code> dan <code>hitungKeliling()</code> pada setiap objek dan cetak hasilnya.`,
    hints: [
      "Mulai dengan blok Interface untuk Bentuk",
      "Gunakan blok Implements pada setiap class turunan",
      "Setiap class harus mengimplementasikan kedua method",
      "Gunakan blok Return untuk mengembalikan nilai perhitungan",
      "Di main method, buat objek dari ketiga class",
    ],
  },
];
