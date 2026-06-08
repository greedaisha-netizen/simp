import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const ignoredDirs = new Set(["node_modules", "dist", ".git", ".vscode"]);

function collectHtmlFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        collectHtmlFiles(join(dir, entry.name), found);
      }
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      found.push(join(dir, entry.name));
    }
  }

  return found;
}

const htmlEntries = Object.fromEntries(
  collectHtmlFiles(rootDir).map((filePath) => [
    relative(rootDir, filePath).replace(/\\/g, "/").replace(/\.html$/i, ""),
    filePath,
  ])
);

export default defineConfig({
  plugins: [
    {
      name: "serve-parent-static-files",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const pathname = url.pathname;

          if (
            pathname.startsWith("/enroll/") ||
            pathname.startsWith("/shared/") ||
            pathname.startsWith("/ADDING_COURSE/") ||
            pathname.startsWith("/SIMP-PROJECT-main/")
          ) {
            const filePath = resolve(rootDir, "..", pathname.slice(1));

            try {
              if (existsSync(filePath) && statSync(filePath).isFile()) {
                const ext = extname(filePath).toLowerCase();
                let contentType = "application/octet-stream";

                if (ext === ".html") contentType = "text/html";
                else if (ext === ".js" || ext === ".mjs") contentType = "application/javascript";
                else if (ext === ".css") contentType = "text/css";
                else if (ext === ".png") contentType = "image/png";
                else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
                else if (ext === ".gif") contentType = "image/gif";
                else if (ext === ".svg") contentType = "image/svg+xml";
                else if (ext === ".json") contentType = "application/json";

                res.setHeader("Content-Type", contentType);
                res.end(readFileSync(filePath));
                return;
              }
            } catch (e) {
              // Ignore and fallback
            }
          }
          next();
        });
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
    fs: {
      allow: [resolve(rootDir, "..")],
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: "dist",
    target: "esnext",
    rollupOptions: {
      input: htmlEntries,
    },
  },
  resolve: {
    alias: {
      "@": resolve(rootDir),
    },
  },
});
