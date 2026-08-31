import express from "express";
import { createServer } from "http";
import net from "net";
import { serveStatic, setupVite } from "./vite";

// Load .env for local dev / self-hosting (Vercel injects env vars itself)
try {
  process.loadEnvFile();
} catch {}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "10mb" }));

  // Mount API endpoints for local dev (Vercel serves these from /api in production)
  const apiRoutes: Array<[string, string]> = [
    ["/api/ocr", "../../api/ocr"],
    ["/api/auth/login", "../../api/auth/login"],
    ["/api/leaderboard", "../../api/leaderboard"],
    ["/api/stores", "../../api/stores"],
    ["/api/my-store", "../../api/my-store/index"],
    ["/api/my-store/metrics", "../../api/my-store/metrics"],
    ["/api/my-store/performer", "../../api/my-store/performer"],
    ["/api/owner/stores", "../../api/owner/stores"],
    ["/api/owner/submissions", "../../api/owner/submissions"],
  ];

  for (const [route, modulePath] of apiRoutes) {
    app.all(route, async (req, res) => {
      try {
        const { default: handler } = await import(modulePath);
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });
  }

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
