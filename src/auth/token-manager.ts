import { getSMHClient } from "../client.js";
import type { SMHConfig } from "../config.js";
import { logger } from "../utils/logger.js";

const RENEW_BEFORE_MS = 5 * 60 * 1000; // 5 minutes
const KEEPALIVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export class TokenManager {
  private currentToken: string = "";
  private expiresAt: number = 0;
  private renewing: Promise<string> | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly config: SMHConfig) {
    if (config.mode === "accessToken" && config.accessToken) {
      this.currentToken = config.accessToken;
      this.expiresAt = Date.now() + KEEPALIVE_INTERVAL_MS;
    }
  }

  getToken(): string {
    return this.currentToken;
  }

  async getValidToken(): Promise<string> {
    if (this.currentToken && this.expiresAt - Date.now() > RENEW_BEFORE_MS) {
      return this.currentToken;
    }
    return this.renew();
  }

  async renew(): Promise<string> {
    if (this.renewing) {
      return this.renewing;
    }
    this.renewing = (async () => {
      try {
        if (this.config.mode === "librarySecret") {
          return await this.signNewToken();
        }
        return await this.renewExistingToken();
      } finally {
        this.renewing = null;
      }
    })();
    return this.renewing;
  }

  /**
   * librarySecret 模式
   */
  private async signNewToken(): Promise<string> {
    const client = getSMHClient();
    const resp = await client.token.createToken({
      libraryId: this.config.libraryId,
      librarySecret: this.config.librarySecret!,
      spaceId: this.config.spaceId,
      userId: this.config.userId,
      grant: this.config.grant as any
    });
    const newToken = resp.data?.accessToken;
    const expiresIn = resp.data?.expiresIn;
    if (!newToken || !expiresIn) {
      throw new Error(
        "createToken 响应缺少 accessToken 或 expiresIn"
      );
    }
    this.currentToken = newToken;
    this.expiresAt = Date.now() + expiresIn * 1000;
    client.setDefaultAccessToken(newToken);
    return newToken;
  }

  private async renewExistingToken(): Promise<string> {
    const client = getSMHClient();
    const tokenBefore = this.currentToken;
    if (!tokenBefore) {
      throw new Error(
        "没有可用的 accessToken 进行续期，请设置 SMH_ACCESS_TOKEN。"
      );
    }
    const resp = await client.token.renewToken({
      libraryId: this.config.libraryId,
      accessToken: tokenBefore,
    });
    const newToken = resp.data?.accessToken;
    const expiresIn = resp.data?.expiresIn;
    if (!newToken || !expiresIn) {
      throw new Error(
        "renewToken 响应缺少 accessToken 或 expiresIn"
      );
    }
    this.currentToken = newToken;
    this.expiresAt = Date.now() + expiresIn * 1000;
    client.setDefaultAccessToken(newToken);
    return newToken;
  }

  startKeepalive(): void {
    if (this.config.mode !== "accessToken") return;
    if (this.keepaliveTimer) return;
    this.keepaliveTimer = setInterval(() => {
      this.renew().catch((e) => {
        logger.warn(`Keepalive 续期失败：${e?.message ?? String(e)}`);
      });
    }, KEEPALIVE_INTERVAL_MS);
    if (typeof this.keepaliveTimer.unref === "function") {
      this.keepaliveTimer.unref();
    }
  }

  stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }
}

let tokenManager: TokenManager | null = null;

export function setTokenManager(tm: TokenManager): void {
  tokenManager = tm;
}

export function getTokenManager(): TokenManager {
  if (!tokenManager) {
    throw new Error(
      "TokenManager 未初始化，请在启动时调用 setTokenManager()。"
    );
  }
  return tokenManager;
}

export async function getAccessToken(): Promise<string> {
  return getTokenManager().getValidToken();
}
