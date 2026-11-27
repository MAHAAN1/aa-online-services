import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Preview deployments must never inherit the shop's production API.
  define: process.env.VERCEL_ENV === "preview" ? {
    "import.meta.env.VITE_API_URL": JSON.stringify(process.env.VITE_PREVIEW_API_URL || "/api"),
    "import.meta.env.VITE_API_PENDING": JSON.stringify(!process.env.VITE_PREVIEW_API_URL),
  } : {},
  server: { proxy: { "/api": "http://127.0.0.1:5000" } },
  plugins: [
    react(),
    tailwindcss()
  ]
});