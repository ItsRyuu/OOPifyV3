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

  const pistonPayload = JSON.stringify({ language: "java", version: "*", files, stdin: stdin || "" });

  return new Promise((resolve) => {
    const options = {
      hostname: "emkc.org",
      path: "/api/v2/piston/execute",
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(pistonPayload) },
    };

    const pistonReq = https.request(options, (pistonRes) => {
      let raw = "";
      pistonRes.on("data", (chunk) => (raw += chunk));
      pistonRes.on("end", () => {
        try {
          const data = JSON.parse(raw);

          // Log ke Vercel Functions log untuk debugging
          console.log("[api/run] Piston response:", JSON.stringify({
            hasCompile: !!data.compile,
            compileCode: data.compile?.code,
            hasRun: !!data.run,
            runCode: data.run?.code,
            runStdout: data.run?.stdout,
            runOutput: data.run?.output,
          }));

          // Cek compile error
          const compile = data.compile || null;
          if (compile && compile.code != null && compile.code !== 0) {
            return res.status(200).json({
              output: "",
              stderr: compile.stderr || compile.output || "Compile error",
              error: "Compilation failed",
            });
          }

          const run = data.run || {};
          const exitCode = run.code;

          // Gunakan stdout, fallback ke output (stdout+stderr gabungan)
          const stdout = run.stdout ?? run.output ?? "";

          res.status(200).json({
            output: stdout,
            stderr: run.stderr || "",
            error: (exitCode != null && exitCode !== 0) ? `Exit code ${exitCode}` : "",
          });
        } catch (e) {
          res.status(502).json({ output: "", stderr: raw.slice(0, 500), error: "Parse error: " + e.message });
        }
        resolve();
      });
    });

    pistonReq.setTimeout(25000, () => {
      pistonReq.destroy();
      res.status(504).json({ output: "", stderr: "", error: "Compiler timeout (>25 detik)." });
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
