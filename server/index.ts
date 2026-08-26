import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function securityHeaders(res: express.Response) {
  res.setHeader("Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' blob: data:; " +
    "connect-src 'self'; " +
    "worker-src 'self'; " +
    "manifest-src 'self';"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=()");
  res.setHeader("X-Frame-Options", "DENY");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);

  app.use((req, res, next) => {
    securityHeaders(res);
    next();
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(
    express.static(staticPath, {
      setHeaders(res, filePath) {
        if (
          filePath.endsWith("sw.js") ||
          filePath.endsWith("manifest.webmanifest") ||
          filePath.endsWith("index.html")
        ) {
          res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        } else if (filePath.match(/\.[a-f0-9]{8,}\./)) {
          // Hashed assets — immutable
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  // Client-side routing — only for non-API, non-file paths
  app.get("*", (req, res) => {
    // If the request looks like a file, return 404
    if (path.extname(req.path) && req.path !== "/") {
      res.status(404).send("Not found");
      return;
    }
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
