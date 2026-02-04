#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  Tool,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response } from "express";
import { createServer } from "http";
import { SMHClient } from "@tencent/smh-node-sdk";
import * as fs from "fs";
import * as path from "path";

interface SMHConfig {
  basePath: string;
  accessToken: string;
  libraryId: string;
  spaceId: string;
  userId: string;
}

let smhClient: SMHClient | null = null;

function loadConfig(): SMHConfig | null {
  const basePath = process.env.SMH_BASE_PATH || "https://api.tencentsmh.cn";
  const accessToken = process.env.SMH_ACCESS_TOKEN;
  const libraryId = process.env.SMH_LIBRARY_ID;
  const spaceId = process.env.SMH_SPACE_ID;
  const userId = process.env.SMH_USER_ID || "mcp-user";

  if (!accessToken || !libraryId || !spaceId) {
    console.warn("Warning: Missing required environment variables (SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, SMH_SPACE_ID).");
    return null;
  }

  return {
    basePath,
    accessToken,
    libraryId,
    spaceId,
    userId,
  };
}

/**
 * Initialize SMH client
 */
function initializeSMHClient(config: SMHConfig): SMHClient {
  const client = new SMHClient({
    basePath: config.basePath,
    accessToken: config.accessToken,
    libraryId: config.libraryId,
    spaceId: config.spaceId,
  });

  return client;
}

/**
 * Get or create SMH client
 */
function getSMHClient(): SMHClient {
  if (!smhClient) {
    const config = loadConfig();
    if (!config) {
      throw new Error(
        "SMH configuration is incomplete. Please ensure SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, and SMH_SPACE_ID environment variables are set."
      );
    }
    smhClient = initializeSMHClient(config);
  }
  return smhClient;
}

/**
 * Get access token
 */
function getAccessToken(config: SMHConfig): string {
  return config.accessToken;
}

// Define tools
const TOOLS: Tool[] = [
  {
    name: "create_upload_task",
    description:
      "Create an advanced upload task with progress tracking and detailed controls. This method is recommended for uploading very large files or when you need to monitor upload progress.",
    inputSchema: {
      type: "object",
      properties: {
        localPath: {
          type: "string",
          description:
            "Absolute or relative path to the local file to upload",
        },
        remotePath: {
          type: "string",
          description:
            "Destination path in SMH (e.g., '/folder/filename.ext')",
        },
        spaceId: {
          type: "string",
          description:
            "Space ID where the file will be uploaded (optional, uses default from config if not provided)",
        },
        chunkSize: {
          type: "number",
          description:
            "Chunk size in MB for large file upload (default: 10, range: 1-100)",
          default: 10,
        },
        parallel: {
          type: "number",
          description:
            "Number of parallel upload tasks (default: 3, range: 1-10)",
          default: 3,
        },
        enableInstantUpload: {
          type: "boolean",
          description:
            "Enable instant upload for small files (default: true)",
          default: true,
        },
      },
      required: ["localPath", "remotePath"],
    },
  },
  {
    name: "rename_file",
    description:
      "Rename or move a file in SMH. Can be used to rename a file or move it to a different directory.",
    inputSchema: {
      type: "object",
      properties: {
        sourcePath: {
          type: "string",
          description:
            "Current path of the file in SMH (e.g., '/folder/oldname.ext')",
        },
        destinationPath: {
          type: "string",
          description:
            "New path for the file in SMH (e.g., '/folder/newname.ext' or '/newfolder/filename.ext')",
        },
        spaceId: {
          type: "string",
          description:
            "Space ID where the file is located (optional, uses default from config if not provided)",
        },
        conflictResolutionStrategy: {
          type: "string",
          enum: ["rename", "overwrite", "ask"],
          description:
            "Strategy when destination file already exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'",
          default: "rename",
        },
      },
      required: ["sourcePath", "destinationPath"],
    },
  },
  {
    name: "create_download_task",
    description:
      "Create an advanced download task with progress tracking and detailed controls. This method is recommended for downloading very large files or when you need to monitor download progress.",
    inputSchema: {
      type: "object",
      properties: {
        remotePath: {
          type: "string",
          description:
            "Path of the file in SMH to download (e.g., '/folder/filename.ext')",
        },
        localPath: {
          type: "string",
          description:
            "Local destination path where the file will be saved",
        },
        spaceId: {
          type: "string",
          description:
            "Space ID where the file is located (optional, uses default from config if not provided)",
        },
        chunkSize: {
          type: "number",
          description:
            "Chunk size in MB for large file download (default: 10, range: 1-100)",
          default: 10,
        },
        parallel: {
          type: "number",
          description:
            "Number of parallel download tasks (default: 3, range: 1-10)",
          default: 3,
        },
        overwrite: {
          type: "boolean",
          description:
            "Whether to overwrite if local file already exists (default: false)",
          default: false,
        },
      },
      required: ["remotePath", "localPath"],
    },
  },
];

/**
 * Rename or move a file in SMH
 */
async function handleRenameFile(args: any): Promise<any> {
  const {
    sourcePath,
    destinationPath,
    spaceId,
    conflictResolutionStrategy = "rename",
  } = args;

  const config = loadConfig();
  if (!config) {
    throw new Error("SMH configuration is incomplete. Please ensure SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, and SMH_SPACE_ID are set.");
  }
  const client = getSMHClient();
  const accessToken = getAccessToken(config);
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  console.log(`Renaming file: ${sourcePath} -> ${destinationPath}`);

  try {
    const result = await client.file.moveFile({
      spaceId: targetSpaceId,
      filePath: destinationPath,
      accessToken: accessToken,
      moveFileRequest: {
        from: sourcePath,
      },
      conflictResolutionStrategy: conflictResolutionStrategy,
    });

    return {
      success: true,
      message: "File renamed successfully",
      sourcePath: sourcePath,
      destinationPath: destinationPath,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`Rename failed: ${error.message}`);
  }
}

/**
 * Create advanced download task
 */
async function handleCreateDownloadTask(args: any): Promise<any> {
  const {
    remotePath,
    localPath,
    spaceId,
    chunkSize = 10,
    parallel = 3,
    overwrite = false,
  } = args;

  const absoluteLocalPath = path.resolve(localPath);

  if (!overwrite) {
    try {
      await fs.promises.access(absoluteLocalPath);
      throw new Error(`Local file already exists: ${absoluteLocalPath}. Set overwrite=true to replace.`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // Ensure destination directory exists
  const destDir = path.dirname(absoluteLocalPath);
  await fs.promises.mkdir(destDir, { recursive: true });

  const config = loadConfig();
  if (!config) {
    throw new Error("SMH configuration is incomplete. Please ensure SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, and SMH_SPACE_ID are set.");
  }
  const client = getSMHClient();
  const accessToken = getAccessToken(config);
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  console.log(`Creating download task: ${remotePath}`);
  console.log(`Destination: ${absoluteLocalPath}`);

  try {
    const task = await client.createDownloadTask({
      spaceId: targetSpaceId,
      userId: config.userId,
      filePath: remotePath,
      localPath: absoluteLocalPath,
      chunkSize: Math.min(Math.max(chunkSize, 1), 100),
      parallel: Math.min(Math.max(parallel, 1), 10),
      verbose: false,
    });

    await task.start();

    const fileStats = await fs.promises.stat(absoluteLocalPath);

    return {
      success: true,
      message: "Download task completed successfully",
      task: {
        remotePath: remotePath,
        localPath: absoluteLocalPath,
        fileSize: fileStats.size,
        chunkSize: chunkSize,
        parallel: parallel,
      },
    };
  } catch (error: any) {
    throw new Error(`Download task failed: ${error.message}`);
  }
}

/**
 * Create advanced upload task
 */
async function handleCreateUploadTask(args: any): Promise<any> {
  const {
    localPath,
    remotePath,
    spaceId,
    chunkSize = 10,
    parallel = 3,
    enableInstantUpload = true,
  } = args;

  const absolutePath = path.resolve(localPath);
  try {
    await fs.promises.access(absolutePath);
  } catch {
    throw new Error(`Local file not found: ${absolutePath}`);
  }

  const fileStats = await fs.promises.stat(absolutePath);
  const fileSize = fileStats.size;
  const config = loadConfig();
  if (!config) {
    throw new Error("SMH configuration is incomplete. Please ensure SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, and SMH_SPACE_ID are set.");
  }
  const client = getSMHClient();

  // Get access token
  const accessToken = getAccessToken(config);
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  console.log(`Creating upload task: ${path.basename(absolutePath)}`);
  console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Destination: ${remotePath}`);

  try {
    const task = await client.createUploadTask({
      spaceId: targetSpaceId,
      userId: config.userId,
      filePath: remotePath,
      localPath: absolutePath,
      enableInstantUpload,
      chunkSize: Math.min(Math.max(chunkSize, 1), 100),
      parallel: Math.min(Math.max(parallel, 1), 10),
      partFileSize: Math.min(Math.max(chunkSize, 1), 100),
      verbose: false,
    });

    await task.start();

    const fileInfo = await client.file.infoFile({
      spaceId: targetSpaceId,
      filePath: remotePath,
      info: 1,
      accessToken: accessToken,
    });

    return {
      success: true,
      message: "Upload task completed successfully",
      task: {
        localPath: absolutePath,
        remotePath: remotePath,
        fileSize: fileSize,
        chunkSize: chunkSize,
        parallel: parallel,
      },
      fileInfo: fileInfo.data,
    };
  } catch (error: any) {
    throw new Error(`Upload task failed: ${error.message}`);
  }
}

/**
 * Main server setup
 */
async function main() {
  console.log("Initializing SMH Upload MCP Server...");

  const config = loadConfig();
  if (config) {
    console.log(`Configuration loaded: libraryId=${config.libraryId}, spaceId=${config.spaceId}`);
  } else {
    console.warn("Warning: Configuration not complete. Server will start but tools will fail if env vars are missing.");
    console.warn("Ensure SMH_ACCESS_TOKEN, SMH_LIBRARY_ID, and SMH_SPACE_ID are set when using tools.");
  }

  // Create Express app
  const app = express();
  const PORT = process.env.MCP_PORT || 3000;

  // Create MCP server
  const server = new Server(
    {
      name: "mcp-smh",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Register call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case "create_upload_task":
          result = await handleCreateUploadTask(args);
          break;
        case "rename_file":
          result = await handleRenameFile(args);
          break;
        case "create_download_task":
          result = await handleCreateDownloadTask(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });

  // Setup SSE endpoint
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("New SSE connection established");
    
    // Enable SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Create SSE transport
    const transport = new SSEServerTransport("/message", res);
    
    // Connect server to transport
    await server.connect(transport);

    console.log("MCP server connected via SSE transport");
  });

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "mcp-smh",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    });
  });

  // Start HTTP server
  const httpServer = createServer(app);
  httpServer.listen(PORT, () => {
    console.log(`SMH Upload MCP Server is running`);
    console.log(`HTTP Server: http://localhost:${PORT}`);
    console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    console.log(`Health Check: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    httpServer.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
}

// Start the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});