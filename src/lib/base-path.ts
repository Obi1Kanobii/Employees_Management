/** Base path when hosted on GitHub Pages (e.g. /emplyees). Empty for local dev. */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

export function withBasePath(path: string): string {
  const base = getBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
