// ============================================================
// Vercel Serverless Function — Java Compiler Proxy
// POST /api/run  —  CommonJS, zero dependencies
// Menggunakan Wandbox API (wandbox.org) — gratis, tanpa API key
// ============================================================

const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { files, stdin } = req.body || {};
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ output: "", stderr: "", error: "Field 'files' diperlukan." });
  }

  // Gabungkan semua file jadi satu kode (Wandbox: single file mode)
  const code = files.map(f => f.content || "").join("\n");

  const wandboxPayload = JSON.stringify({
    compiler: "openjdk-head",   // Java terbaru di Wandbox
    code: code,
    stdin: stdin || "",
    "compiler-option-raw": "",
    "runtime-option-raw": "",
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "wandbox.org",
      path: "/api/compile.json",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(wandboxPayload),
        "User-Agent": "OOPify-v3/1.0",
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      let raw = "";
      apiRes.on("data", (chunk) => (raw += chunk));
      apiRes.on("end", () => {
        try {
          const data = JSON.parse(raw);

          // Wandbox response: { status, program_output, program_error, compiler_error, compiler_output }
          const stdout    = data.program_output  || "";
          const stderr    = data.program_error   || "";
          const compErr   = data.compiler_error  || "";
          const exitCode  = parseInt(data.status, 10); // "0" = sukses

          // Jika ada compile error tampilkan sebagai stderr
          const finalStderr = compErr ? compErr + "\n" + stderr : stderr;
          const error = (compErr) ? "Compilation failed"
                      : (exitCode !== 0 && !isNaN(exitCode)) ? `Exit code ${exitCode}`
                      : "";

          res.status(200).json({
            output: stdout,
            stderr: finalStderr,
            error,
          });
        } catch (e) {
          res.status(502).json({ output: "", stderr: raw.slice(0, 500), error: "Parse error: " + e.message });
        }
        resolve();
      });
    });

    apiReq.setTimeout(30000, () => {
      apiReq.destroy();
      res.status(504).json({ output: "", stderr: "", error: "Compiler timeout (>30 detik)." });
      resolve();
    });

    apiReq.on("error", (e) => {
      res.status(500).json({ output: "", stderr: "", error: "Network error: " + e.message });
      resolve();
    });

    apiReq.write(wandboxPayload);
    apiReq.end();
  });
};
