import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
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

const staticRuntimePaths = [
  "img",
  "shared",
  "pages/general_files",
  "enroll/course-images",
  "Steqyy_model.2048",
  "Steqyy_model.cdi3.json",
  "Steqyy_model.moc3",
  "Steqyy_model.model3.json",
];

export default defineConfig({
  plugins: [
    {
      name: "copy-static-runtime-files",
      closeBundle() {
        for (const runtimePath of staticRuntimePaths) {
          const source = resolve(rootDir, runtimePath);
          const target = resolve(rootDir, "dist", runtimePath);

          if (existsSync(source)) {
            rmSync(target, { recursive: true, force: true });
            cpSync(source, target, { recursive: true });
          }
        }
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
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
