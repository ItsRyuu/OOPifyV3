const https = require("https");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { files, stdin } = req.body || {};
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ output: "", stderr: "Field 'files' diperlukan.", error: "" });
  }

  // Debug: tampilkan apa yang kita terima dari frontend
  const receivedInfo = files.map(f => ({
    name: f.name,
    contentLength: (f.content || "").length,
    preview: (f.content || "").slice(0, 80),
  }));

  const pistonPayload = JSON.stringify({ language: "java", version: "*", files, stdin: stdin || "" });

  return new Promise((resolve) => {
    const options = {
      hostname: "emkc.org",
      path: "/api/v2/piston/execute",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(pistonPayload),
      },
    };

    const pistonReq = https.request(options, (pistonRes) => {
      let raw = "";
      pistonRes.on("data", (chunk) => (raw += chunk));
      pistonRes.on("end", () => {
        try {
          const data = JSON.parse(raw);
          const compile = data.compile || null;
          const run = data.run || {};
          const stdout = run.stdout ?? run.output ?? "";

          // Jika output kosong, sertakan info debug di stderr agar terlihat di terminal
          const debugInfo = stdout.trim() === ""
            ? `[DEBUG] Files received: ${JSON.stringify(receivedInfo)}\n` +
              `[DEBUG] Piston HTTP: ${pistonRes.statusCode}\n` +
              `[DEBUG] compile: code=${compile?.code} stderr="${compile?.stderr?.slice(0,100)}"\n` +
              `[DEBUG] run: code=${run.code} stdout="${run.stdout}" output="${run.output}"\n`
            : "";

          const exitCode = run.code;
          let error = "";
          if (compile && compile.code != null && compile.code !== 0) {
            error = "Compilation failed";
          } else if (exitCode != null && exitCode !== 0) {
            error = `Exit code ${exitCode}`;
          }

          res.status(200).json({
            output: stdout,
            stderr: (run.stderr || "") + debugInfo,
            error,
          });
        } catch (e) {
          res.status(502).json({ output: "", stderr: raw.slice(0, 500), error: "Parse error: " + e.message });
        }
        resolve();
      });
    });

    pistonReq.setTimeout(25000, () => {
      pistonReq.destroy();
      res.status(504).json({ output: "", stderr: "", error: "Compiler timeout." });
      resolve();
    });

    pistonReq.on("error", (e) => {
      res.status(500).json({ output: "", stderr: "", error: "Network error: " + e.message });
      resolve();
    });

    pistonReq.write(pistonPayload);
    pistonReq.end();
  });
};
