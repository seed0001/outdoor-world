import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // Cloudflare quick tunnels send a changing `*.trycloudflare.com` Host header. Only
    // `allowedHosts: true` fully disables Vite’s host middleware (`host-validation-middleware`
    // is skipped); pattern lists can still fail on edge cases (casing, unexpected Host shapes).
    // Dev-only — do not ship this wide-open setting as your production server config.
    allowedHosts: true,
  },
  preview: {
    // Same check applies to `vite preview` behind a tunnel.
    allowedHosts: true,
  },
});
