// ============================================================
// Vercel Serverless Function — Java Compiler Proxy
// POST /api/run
// CommonJS format (tidak butuh package.json / build step)
// ============================================================

const https = require("https");

module.exports = async function handler(req, res) {
  // CORS headers (opsional tapi aman)
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
          const run = data.run || {};
          res.status(200).json({
            output: run.stdout || "",
            stderr: run.stderr || "",
            error: run.code !== 0 ? `Exit code ${run.code}` : "",
          });
        } catch (e) {
          res.status(502).json({
            output: "",
            stderr: raw,
            error: "Gagal parse response dari compiler: " + e.message,
          });
        }
        resolve();
      });
    });

    // Timeout 25 detik (Vercel functions limit: 30s default)
    pistonReq.setTimeout(25000, () => {
      pistonReq.destroy();
      res.status(504).json({
        output: "",
        stderr: "",
        error: "Compiler timeout (>25 detik). Coba sederhanakan kode.",
      });
      resolve();
    });

    pistonReq.on("error", (e) => {
      res.status(500).json({
        output: "",
        stderr: "",
        error: "Tidak dapat terhubung ke compiler: " + e.message,
      });
      resolve();
    });

    pistonReq.write(pistonPayload);
    pistonReq.end();
  });
};
