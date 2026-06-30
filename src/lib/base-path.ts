/** Base path when hosted on GitHub Pages (e.g. /Employees_Management). Empty for local dev. */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

/**
 * Prefix a static asset URL with the base path (e.g. supabase-config.js in layout).
 * Do NOT use for router.push/replace or <Link> — Next.js adds basePath automatically.
 */
export function withBasePath(path: string): string {
  const base = getBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
