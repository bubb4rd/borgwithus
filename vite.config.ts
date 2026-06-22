import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ollamaTarget = env.VITE_OLLAMA_URL || "http://127.0.0.1:11434";
  const ollamaProxy = {
    target: ollamaTarget,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ollama/, ""),
    timeout: 120_000,
    proxyTimeout: 120_000,
  };

  return {
    plugins: [react(), tailwindcss()],
    base: "/",
    server: {
      proxy: {
        "/ollama": ollamaProxy,
      },
    },
    preview: {
      proxy: {
        "/ollama": ollamaProxy,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            gsap: ["gsap", "@gsap/react"],
          },
        },
      },
    },
  };
});
