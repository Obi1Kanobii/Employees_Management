import { copyFileSync } from "node:fs";

// GitHub Pages uses 404.html as SPA fallback for unknown routes.
copyFileSync("out/index.html", "out/404.html");

console.log("Prepared out/ for GitHub Pages (404.html SPA fallback).");
