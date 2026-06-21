// ============================================================
// Vercel Serverless Function — Java Compiler Proxy
// POST /api/run  —  CommonJS, zero dependencies
// ============================================================

const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { files, stdin } = req.body || {};

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({
      output: "",
      stderr: "",
      error: "Field 'files' diperlukan.",
    });
  }

  const pistonPayload = JSON.stringify({
    language: "java",
    version: "*",
    files,
    stdin: stdin || "",
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "emkc.org",
      path: "/api/v2/piston/execute",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(pistonPayload),
        "User-Agent": "OOPify-v3/1.0",
      },
    };

    const pistonReq = https.request(options, (pistonRes) => {
      let raw = "";
      pistonRes.on("data", (chunk) => (raw += chunk));
      pistonRes.on("end", () => {
        try {
          const data = JSON.parse(raw);

          // ── Cek compile error terlebih dahulu ─────────────────
          // Jika compile gagal, Piston tidak menjalankan program sama sekali
          const compile = data.compile || null;
          if (compile && compile.code != null && compile.code !== 0) {
            return res.status(200).json({
              output: "",
              stderr: compile.stderr || compile.output || "Compile error",
              error: `Compilation failed`,
            });
          }

          // ── Hasil run ─────────────────────────────────────────
          const run = data.run || {};
          const exitCode = run.code; // bisa 0, 1, null, atau undefined

          res.status(200).json({
            output: run.stdout || "",
            stderr: run.stderr || "",
            // null/undefined = tidak ada info exit code = anggap sukses
            error: (exitCode != null && exitCode !== 0)
              ? `Exit code ${exitCode}`
              : "",
          });
        } catch (e) {
          res.status(502).json({
            output: "",
            stderr: raw.slice(0, 500),
            error: "Gagal parse response: " + e.message,
          });
        }
        resolve();
      });
    });

    pistonReq.setTimeout(25000, () => {
      pistonReq.destroy();
      res.status(504).json({
        output: "",
        stderr: "",
        error: "Compiler timeout (>25 detik).",
      });
      resolve();
    });

    pistonReq.on("error", (e) => {
      res.status(500).json({
        output: "",
        stderr: "",
        error: "Network error: " + e.message,
      });
      resolve();
    });

    pistonReq.write(pistonPayload);
    pistonReq.end();
  });
};
