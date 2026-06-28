// ============================================================
// Vercel Serverless Function — Java Compiler via JDoodle
// POST /api/run  —  CommonJS, zero dependencies
// ============================================================

const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ output: "", stderr: "", error: "Method Not Allowed" });
  }

  // Validasi env vars
  const clientId     = process.env.JDOODLE_CLIENT_ID;
  const clientSecret = process.env.JDOODLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      output: "",
      stderr: "",
      error: "Server belum dikonfigurasi: JDOODLE_CLIENT_ID / JDOODLE_CLIENT_SECRET belum diset di Vercel.",
    });
  }

  const { files, stdin } = req.body || {};
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ output: "", stderr: "", error: "Field 'files' diperlukan." });
  }

  // Gabungkan semua file menjadi satu script
  const script = files.map(f => f.content || "").join("\n");

  const jdoodlePayload = JSON.stringify({
    clientId,
    clientSecret,
    script,
    language:     "java",
    versionIndex: "4",        // Java 17
    stdin:        stdin || "",
  });

  return new Promise((resolve) => {
    const options = {
      hostname: "api.jdoodle.com",
      path:     "/v1/execute",
      method:   "POST",
      headers: {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(jdoodlePayload),
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      let raw = "";
      apiRes.on("data", (chunk) => (raw += chunk));
      apiRes.on("end", () => {
        try {
          const data = JSON.parse(raw);

          // JDoodle response: { output, statusCode, memory, cpuTime }
          // statusCode 200 = sukses, 400 = error input, 401 = auth error, dll
          if (apiRes.statusCode !== 200 || data.statusCode === 401) {
            return res.status(200).json({
              output: "",
              stderr: "",
              error: `JDoodle auth error: periksa JDOODLE_CLIENT_ID dan CLIENT_SECRET di Vercel. (HTTP ${apiRes.statusCode})`,
            });
          }

          const output = data.output || "";

          // JDoodle menggabungkan stdout + stderr dalam satu field "output"
          // Deteksi apakah ada compile error dari tanda-tanda umum
          const isCompileError = output.includes("error:") && output.includes(".java:");
          const isRuntimeError = output.includes("Exception in thread");

          res.status(200).json({
            output: isCompileError || isRuntimeError ? "" : output,
            stderr: isCompileError || isRuntimeError ? output : "",
            error:  isCompileError ? "Compilation failed"
                  : isRuntimeError ? "Runtime error"
                  : "",
          });
        } catch (e) {
          res.status(502).json({
            output: "",
            stderr: `Raw response: ${raw.slice(0, 300)}`,
            error:  "Parse error: " + e.message,
          });
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

    apiReq.write(jdoodlePayload);
    apiReq.end();
  });
};
