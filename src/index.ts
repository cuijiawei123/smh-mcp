#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as http from "node:http";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "url";
import {
  setTokenManager,
  TokenManager,
} from "./auth/token-manager.js";
import { loadConfig } from "./config.js";
import { logger } from "./utils/logger.js";
import { registerSmhPrompts } from "./utils/prompts.js";
import { registerSmhTools } from "./tools.js";

// ============ Version ============
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJsonPath = path.resolve(__dirname, "../package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as {
  name: string;
  version: string;
};

const SERVER_NAME = packageJson.name;
const SERVER_VERSION = packageJson.version;

function buildMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        prompts: {},
      },
    }
  );

  registerSmhTools(server);
  registerSmhPrompts(server);

  return server;
}

async function runStdio(): Promise<void> {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

async function runStreamableHttp(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);

  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const { isInitializeRequest } = await import(
    "@modelcontextprotocol/sdk/types.js"
  );

  // Per-session transport registry
  const transports = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", name: SERVER_NAME, version: SERVER_VERSION }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());

      if (!isInitializeRequest(body)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: No valid session ID provided" },
          id: null,
        }));
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          transports.set(id, transport);
          logger.info(`Session initialized: ${id}`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
          logger.info(`Session closed: ${sid}`);
        }
      };

      const server = buildMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: Invalid or missing session ID" },
      id: null,
    }));
  });

  httpServer.listen(port, () => {
    logger.info(
      `${SERVER_NAME} v${SERVER_VERSION} running on Streamable HTTP at http://localhost:${port}/mcp`
    );
  });

  process.on("SIGINT", async () => {
    logger.info("Shutting down HTTP server...");
    for (const [sid, transport] of transports) {
      try {
        await transport.close();
      } catch (e) {
        logger.warn(`Error closing session ${sid}: ${e}`);
      }
    }
    transports.clear();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config) {
    const tm = new TokenManager(config);
    setTokenManager(tm);
    try {
      await tm.renew();
      tm.startKeepalive();
    } catch (e: any) {
      logger.warn(
        `初始 Token 准备失败：${e?.message ?? String(e)}，将在下次工具调用时重试。`
      );
    }
  } else {
    logger.warn(
      "配置不完整，请设置 SMH_LIBRARY_ID、SMH_SPACE_ID 以及 SMH_LIBRARY_SECRET 或 SMH_ACCESS_TOKEN。"
    );
  }

  const transportMode = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();

  if (transportMode === "http") {
    await runStreamableHttp();
  } else {
    await runStdio();
  }
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});