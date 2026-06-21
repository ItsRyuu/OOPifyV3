// ============================================================
// Vercel Serverless Function — Java Compiler Proxy
// POST /api/run
//
// Meneruskan request ke Piston API (gratis, tanpa API key).
// Return format: { output, stderr, error }
// ─────────────────────────────────────────────────────────────
// GANTI COMPILER: jika ingin pakai JDoodle / Judge0 di masa depan,
// cukup ganti COMPILER_URL dan logika fetch di bawah.
// API key taruh di Vercel Dashboard → Environment Variables.
// ============================================================

const COMPILER_URL = "https://emkc.org/api/v2/piston/execute";

export default async function handler(req, res) {
  // Hanya terima POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { files, stdin } = req.body || {};

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "Field 'files' diperlukan." });
  }

  try {
    const pistonRes = await fetch(COMPILER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "java",
        version: "*",
        files,
        stdin: stdin || "",
      }),
    });

    if (!pistonRes.ok) {
      const errText = await pistonRes.text();
      return res.status(502).json({
        output: "",
        stderr: "",
        error: `Compiler service error (${pistonRes.status}): ${errText}`,
      });
    }

    const pistonData = await pistonRes.json();
    const run = pistonData.run || {};

    // Normalisasi ke format yang dipakai main.js
    return res.status(200).json({
      output: run.stdout || "",
      stderr: run.stderr || "",
      error: run.code !== 0 ? `Exit code ${run.code}` : "",
    });
  } catch (err) {
    return res.status(500).json({
      output: "",
      stderr: "",
      error: `Internal proxy error: ${err.message}`,
    });
  }
}
