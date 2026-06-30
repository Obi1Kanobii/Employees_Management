import { copyFileSync, rmSync, writeFileSync } from "node:fs";

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

// Disable Jekyll on GitHub Pages so _next/ and other underscore paths are served.
writeFileSync("out/.nojekyll", "");

// SPA fallback for client-side routes.
copyFileSync("out/index.html", "out/404.html");

// Next.js also exports a 404/ folder; it conflicts with root 404.html on GitHub Pages.
rmSync("out/404", { recursive: true, force: true });

writeFileSync(
  "out/supabase-config.js",
  `window.__SUPABASE_CONFIG__=${JSON.stringify({ url, anonKey })};\n`
);

console.log("Prepared out/ for GitHub Pages.");
