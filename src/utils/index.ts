import * as path from "path";

export function resolveLocalPath(localPath: string, baseDir?: string): string {
  const base = baseDir ?? process.cwd();
  const resolved = path.resolve(base, localPath);
  return resolved;
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
  return Math.min(Math.max(n, min), max);
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`参数错误：'${name}' 不能为空字符串`);
  }
  return value;
}


export function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, "");
}
