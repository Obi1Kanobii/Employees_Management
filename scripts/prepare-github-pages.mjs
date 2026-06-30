import { copyFileSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!url || !anonKey) {
  console.error(
    "ERROR: Missing Supabase env vars.\n" +
      "Add these GitHub Actions secrets and redeploy:\n" +
      "  - NEXT_PUBLIC_SUPABASE_URL\n" +
      "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

// GitHub Pages SPA fallback
copyFileSync("out/index.html", "out/404.html");

// Runtime config for static hosting (inlined env can be missing if secrets were absent at build)
writeFileSync(
  "out/supabase-config.js",
  `window.__SUPABASE_CONFIG__=${JSON.stringify({ url, anonKey })};\n`
);

console.log("Prepared out/ for GitHub Pages.");
