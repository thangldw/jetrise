import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production pages are static (GitHub Pages cannot send headers), so the policy ships as a meta tag.
// It is added at build time only: the dev server injects inline scripts for React Fast Refresh.
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const cspMeta = {
  name: "content-security-policy-meta",
  apply: "build",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html.replace(
        /<meta charset="[^"]*"\s*\/?>/i,
        (charset) => `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">`,
      ),
  },
};

export default defineConfig({
  build: {
    outDir: "dist/client",
    rollupOptions: { output: { manualChunks: { airports: ["./src/data/airports.js"] } } },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), cspMeta],
});
