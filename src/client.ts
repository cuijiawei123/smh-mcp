import { SMHClient } from "smh-node-sdk";
import { loadConfig, resetConfig, type SMHConfig } from "./config.js";

let smhClient: SMHClient | null = null;

function buildClient(config: SMHConfig): SMHClient {
  return new SMHClient({
    basePath: config.basePath,
    libraryId: config.libraryId,
    spaceId: config.spaceId,
    ...(config.accessToken ? { accessToken: config.accessToken } : {}),
  });
}

export function getSMHClient(): SMHClient {
  if (!smhClient) {
    const config = loadConfig();
    if (!config) {
      throw new Error(
        "SMH 配置不完整，请确保已设置 SMH_LIBRARY_ID、SMH_SPACE_ID，以及 SMH_LIBRARY_SECRET 或 SMH_ACCESS_TOKEN。"
      );
    }
    smhClient = buildClient(config);
  }
  return smhClient;
}

export function requireConfig(): SMHConfig {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      "SMH 配置不完整，请确保已设置 SMH_LIBRARY_ID、SMH_SPACE_ID，以及 SMH_LIBRARY_SECRET 或 SMH_ACCESS_TOKEN。"
    );
  }
  return config;
}

export function resetSMHClient(): void {
  resetConfig();
  smhClient = null;
}
