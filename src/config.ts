import { logger } from "./utils/logger.js";

export type AuthMode = "librarySecret" | "accessToken";

export interface SMHConfig {
  basePath: string;
  libraryId: string;
  spaceId: string;
  userId: string;
  grant: string;
  mode: AuthMode;
  // ======= librarySecret ｜ accessToken 二选一 =======
  librarySecret?: string;
  accessToken?: string;
}

let cachedConfig: SMHConfig | null | undefined = undefined;

export function loadConfig(): SMHConfig | null {
  if (cachedConfig !== undefined) {
    return cachedConfig;
  }

  const basePath = process.env.SMH_BASE_PATH || "https://api.tencentsmh.cn";
  const libraryId = process.env.SMH_LIBRARY_ID;
  const spaceId = process.env.SMH_SPACE_ID;
  const userId = process.env.SMH_USER_ID || "mcp-user";
  const grant = process.env.SMH_GRANT || "admin";
  const librarySecret = process.env.SMH_LIBRARY_SECRET;
  const accessToken = process.env.SMH_ACCESS_TOKEN;

  if (!libraryId || !spaceId) {
    logger.warn(
      "缺少必要的环境变量（SMH_LIBRARY_ID、SMH_SPACE_ID）。"
    );
    cachedConfig = null;
    return cachedConfig;
  }

  if (!librarySecret && !accessToken) {
    logger.warn(
      "缺少凭证，请设置 SMH_LIBRARY_SECRET（推荐）或 SMH_ACCESS_TOKEN。"
    );
    cachedConfig = null;
    return cachedConfig;
  }

  if (librarySecret) {
    cachedConfig = {
      basePath,
      libraryId,
      spaceId,
      userId,
      grant,
      mode: "librarySecret",
      librarySecret,
    };
  } else {
    cachedConfig = {
      basePath,
      libraryId,
      spaceId,
      userId,
      grant,
      mode: "accessToken",
      accessToken,
    };
  }

  return cachedConfig;
}

export function resetConfig(): void {
  cachedConfig = undefined;
}
