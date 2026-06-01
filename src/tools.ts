import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isInvalidAccessTokenError } from "./auth/errors.js";
import { getAccessToken, getTokenManager } from "./auth/token-manager.js";
import { getSMHClient, resetSMHClient } from "./client.js";
import { handleCreateDownloadTask } from "./handlers/download.js";
import {
  handleCreateDirectory,
  handleInfoFileOrDirectory,
  handleListDirectory,
} from "./handlers/directory.js";
import { handleSearchFiles } from "./handlers/search.js";
import {
  handleBatchCopy,
  handleBatchDelete,
  handleBatchMove,
  handleCopyFile,
  handleDeleteFile,
  handleListRecycledItems,
  handleMoveFile,
  handleRenameFile,
  handleRestoreRecycledItem,
} from "./handlers/file-ops.js";
import { handleCreateUploadTask } from "./handlers/upload.js";

type McpResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(result: unknown): McpResult {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

function fail(payload: unknown): McpResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

async function wrap(run: () => Promise<unknown>): Promise<McpResult> {
  try {
    const token = await getAccessToken();
    getSMHClient().setDefaultAccessToken(token);
    return ok(await run());
  } catch (error: any) {
    if (isInvalidAccessTokenError(error)) {
      try {
        const newToken = await getTokenManager().renew();
        getSMHClient().setDefaultAccessToken(newToken);
        return ok(await run());
      } catch (retryError: any) {
        return fail({
          success: false,
          error: retryError?.message ?? String(retryError),
          hint:
            "Token 续期后重试仍失败，请检查凭证：" +
            "librarySecret 模式下检查 SMH_LIBRARY_SECRET 是否有效；" +
            "accessToken 模式下 token 可能已超过最大可续期窗口，需重新签发并重启 MCP。",
        });
      }
    }
    return fail({
      success: false,
      error: error?.message ?? String(error),
    });
  }
}

export function registerSmhTools(server: McpServer): void {
  server.registerTool(
    "create_upload_task",
    {
      description:
        "Create an advanced upload task with progress tracking and detailed controls. This method is recommended for uploading very large files or when you need to monitor upload progress.",
      inputSchema: {
        localPath: z
          .string()
          .describe("Absolute or relative path to the local file to upload"),
        remotePath: z
          .string()
          .describe("Destination path in SMH. Must NOT start with '/'. Example: 'folder/filename.ext'"),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID where the file will be uploaded (optional, uses default from config if not provided)"
          ),
        chunkSize: z
          .number()
          .min(1)
          .max(100)
          .default(10)
          .describe(
            "Size of each chunk in MB when multipart upload is used (default: 10, range: 1-100). Note: SDK may auto-adjust based on file size."
          ),
        multipartThreshold: z
          .number()
          .min(1)
          .max(1024)
          .default(32)
          .describe(
            "File size threshold in MB above which multipart upload is used; smaller files use simple upload / instant upload (default: 32, range: 1-1024)"
          ),
        parallel: z
          .number()
          .min(1)
          .max(10)
          .default(3)
          .describe("Number of parallel upload tasks (default: 3, range: 1-10)"),
        enableInstantUpload: z
          .boolean()
          .default(true)
          .describe("Enable instant upload for small files (default: true)"),
        conflictResolutionStrategy: z
          .enum(["rename", "overwrite", "ask"])
          .default("overwrite")
          .describe(
            "Strategy when remote file already exists: 'overwrite' (replace existing file), 'rename' (auto-rename), 'ask' (return error). Default: 'overwrite'"
          ),
      },
    },
    async (args) => wrap(() => handleCreateUploadTask(args))
  );

  server.registerTool(
    "rename_file",
    {
      description:
        "Rename or move a file in SMH. Can be used to rename a file or move it to a different directory.",
      inputSchema: {
        sourcePath: z
          .string()
          .describe(
            "Current path of the file in SMH. Must NOT start with '/'. Example: 'folder/oldname.ext'"
          ),
        destinationPath: z
          .string()
          .describe(
            "New path for the file in SMH. Must NOT start with '/'. Example: 'folder/newname.ext' or 'newfolder/filename.ext'"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID where the file is located (optional, uses default from config if not provided)"
          ),
        conflictResolutionStrategy: z
          .enum(["rename", "overwrite", "ask"])
          .default("rename")
          .describe(
            "Strategy when destination file already exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'"
          ),
      },
    },
    async (args) => wrap(() => handleRenameFile(args))
  );

  server.registerTool(
    "create_download_task",
    {
      description:
        "Create an advanced download task with progress tracking and detailed controls. This method is recommended for downloading very large files or when you need to monitor download progress.",
      inputSchema: {
        remotePath: z
          .string()
          .describe(
            "Path of the file in SMH to download. Must NOT start with '/'. Example: 'folder/filename.ext'"
          ),
        localPath: z
          .string()
          .describe("Local destination path where the file will be saved"),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID where the file is located (optional, uses default from config if not provided)"
          ),
        chunkSize: z
          .number()
          .min(1)
          .max(100)
          .default(10)
          .describe(
            "Size of each chunk in MB when multipart download is used (default: 10, range: 1-100)"
          ),
        multipartThreshold: z
          .number()
          .min(1)
          .max(1024)
          .default(32)
          .describe(
            "File size threshold in MB above which multipart download is used; smaller files use simple download (default: 32, range: 1-1024)"
          ),
        parallel: z
          .number()
          .min(1)
          .max(10)
          .default(3)
          .describe(
            "Number of parallel download tasks (default: 3, range: 1-10)"
          ),
        overwrite: z
          .boolean()
          .default(false)
          .describe(
            "Whether to overwrite if local file already exists (default: false)"
          ),
      },
    },
    async (args) => wrap(() => handleCreateDownloadTask(args))
  );

  server.registerTool(
    "copy_file",
    {
      description:
        "Copy a file in SMH to a new location. The original file remains unchanged.",
      inputSchema: {
        sourcePath: z
          .string()
          .describe(
            "Source path of the file in SMH to copy. Must NOT start with '/'. Example: 'folder/file.ext'"
          ),
        destinationPath: z
          .string()
          .describe(
            "Destination path for the copied file in SMH. Must NOT start with '/'. Example: 'newfolder/file.ext'"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        conflictResolutionStrategy: z
          .enum(["rename", "overwrite", "ask"])
          .default("rename")
          .describe(
            "Strategy when destination file already exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'"
          ),
      },
    },
    async (args) => wrap(() => handleCopyFile(args))
  );

  server.registerTool(
    "move_file",
    {
      description:
        "Move a file in SMH to a different directory. The file will be removed from the original location.",
      inputSchema: {
        sourcePath: z
          .string()
          .describe(
            "Current path of the file in SMH. Must NOT start with '/'. Example: 'folder/file.ext'"
          ),
        destinationPath: z
          .string()
          .describe(
            "New path for the file in SMH. Must NOT start with '/'. Example: 'newfolder/file.ext'"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        conflictResolutionStrategy: z
          .enum(["rename", "overwrite", "ask"])
          .default("rename")
          .describe(
            "Strategy when destination file already exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'"
          ),
      },
    },
    async (args) => wrap(() => handleMoveFile(args))
  );

  server.registerTool(
    "list_directory",
    {
      description:
        "List the contents of a directory in SMH. Returns files and subdirectories with their metadata. Supports pagination, sorting, and filtering.",
      inputSchema: {
        dirPath: z
          .string()
          .default("")
          .describe(
            "Directory path in SMH to list. Must NOT start with '/'. Example: 'folder/subfolder'. Use empty string for root directory."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe(
            "Maximum number of items to return per page (default: 20, range: 1-100)"
          ),
        marker: z
          .string()
          .optional()
          .describe(
            "Pagination marker from previous response for fetching next page"
          ),
        orderBy: z
          .enum(["name", "modificationTime", "size"])
          .optional()
          .describe("Sort field: 'name', 'modificationTime', or 'size'"),
        orderByType: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction: 'asc' (ascending) or 'desc' (descending)"),
        filter: z
          .enum(["onlyDir", "onlyFile"])
          .optional()
          .describe(
            "Filter type: 'onlyDir' for directories only, 'onlyFile' for files only. Omit to return all."
          ),
      },
    },
    async (args) => wrap(() => handleListDirectory(args))
  );

  server.registerTool(
    "info_file_or_directory",
    {
      description:
        "Get detailed information about a file or directory in SMH, including size, modification time, type, and other metadata.",
      inputSchema: {
        filePath: z
          .string()
          .describe(
            "Path of the file or directory in SMH. Must NOT start with '/'. Example: 'folder/filename.ext' or 'folder/subfolder'"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
      },
    },
    async (args) => wrap(() => handleInfoFileOrDirectory(args))
  );

  server.registerTool(
    "delete_file",
    {
      description:
        "Delete a file or directory in SMH. By default, the file is moved to the recycle bin (if enabled). Set permanent to true to permanently delete the file.",
      inputSchema: {
        filePath: z
          .string()
          .describe(
            "Path of the file or directory in SMH to delete. Must NOT start with '/'. Example: 'folder/file.ext' or 'folder/subfolder'"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        permanent: z
          .boolean()
          .default(false)
          .describe(
            "Whether to permanently delete the file (true) or move it to the recycle bin (false). Default: false"
          ),
      },
    },
    async (args) => wrap(() => handleDeleteFile(args))
  );

  server.registerTool(
    "list_recycled_items",
    {
      description:
        "List items in the recycle bin (trash). Use this tool to find deleted files/directories that can be restored. Returns recycledItemId which is needed for the restore operation.",
      inputSchema: {
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe(
            "Maximum number of items to return per page (default: 20, range: 1-100)"
          ),
        marker: z
          .string()
          .optional()
          .describe(
            "Pagination marker from previous response for fetching next page"
          ),
        orderBy: z
          .enum(["name", "modificationTime", "size", "removalTime", "remainingTime"])
          .optional()
          .describe(
            "Sort field: 'name', 'modificationTime', 'size', 'removalTime' (deletion time), or 'remainingTime' (time before permanent deletion)"
          ),
        orderByType: z
          .enum(["asc", "desc"])
          .optional()
          .describe("Sort direction: 'asc' (ascending) or 'desc' (descending)"),
      },
    },
    async (args) => wrap(() => handleListRecycledItems(args))
  );

  server.registerTool(
    "restore_from_recycle_bin",
    {
      description:
        "Restore a deleted file or directory from the recycle bin (trash) back to its original location. Use 'list_recycled_items' first to get the recycledItemId. Requires admin, space_admin, or restore_recycled permission.",
      inputSchema: {
        recycledItemId: z
          .number()
          .describe(
            "The ID of the recycled item to restore. Get this from 'list_recycled_items' tool."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        conflictResolutionStrategy: z
          .enum(["ask", "rename", "overwrite"])
          .default("ask")
          .describe(
            "Strategy when a file with the same name exists at the restore location: 'ask' (return error on conflict), 'rename' (auto-rename), 'overwrite' (overwrite existing file, but returns error if target is a directory). Default: 'ask'"
          ),
        restorePathStrategy: z
          .enum(["originalPath", "fallbackToRoot"])
          .default("originalPath")
          .describe(
            "How to handle the restore path: 'originalPath' (restore to original location, error if path no longer exists), 'fallbackToRoot' (restore to original path, fallback to root if path doesn't exist). Default: 'originalPath'"
          ),
      },
    },
    async (args) => wrap(() => handleRestoreRecycledItem(args))
  );

  server.registerTool(
    "batch_delete",
    {
      description:
        "Batch delete multiple files or directories in SMH. Supports mixed permanent deletion and recycle bin. Automatically handles async task polling for large batches.",
      inputSchema: {
        items: z
          .array(
            z.object({
              path: z
                .string()
                .describe(
                  "Path of the file or directory to delete. Must NOT start with '/'. Example: 'folder/file.ext'"
                ),
              permanent: z
                .boolean()
                .optional()
                .describe(
                  "Whether to permanently delete this item (true) or move to recycle bin (false). Default: false"
                ),
            })
          )
          .describe(
            "Array of items to delete. Each item specifies a path and optional permanent flag."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
      },
    },
    async (args) => wrap(() => handleBatchDelete(args))
  );

  server.registerTool(
    "batch_move",
    {
      description:
        "Batch move multiple files or directories in SMH to new locations. Can also be used for batch renaming by specifying different filenames within the same directory. Each item specifies source and destination paths. Automatically handles async task polling for large batches.",
      inputSchema: {
        items: z
          .array(
            z.object({
              from: z
                .string()
                .describe(
                  "Source path of the file or directory. Must NOT start with '/'. Example: 'folder/file.ext'"
                ),
              to: z
                .string()
                .describe(
                  "Destination path. Must NOT start with '/'. Example: 'newfolder/file.ext'"
                ),
              conflictResolutionStrategy: z
                .enum(["rename", "overwrite", "ask"])
                .optional()
                .describe(
                  "Strategy when destination exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'"
                ),
            })
          )
          .describe(
            "Array of move operations. Each item specifies source path, destination path, and optional conflict strategy."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
      },
    },
    async (args) => wrap(() => handleBatchMove(args))
  );

  server.registerTool(
    "batch_copy",
    {
      description:
        "Batch copy multiple files or directories in SMH to new locations. Original files remain unchanged. Each item specifies source and destination paths. Automatically handles async task polling for large batches.",
      inputSchema: {
        items: z
          .array(
            z.object({
              copyFrom: z
                .string()
                .describe(
                  "Source path of the file or directory to copy. Must NOT start with '/'. Example: 'folder/file.ext'"
                ),
              to: z
                .string()
                .describe(
                  "Destination path for the copy. Must NOT start with '/'. Example: 'newfolder/file.ext'"
                ),
              conflictResolutionStrategy: z
                .enum(["rename", "overwrite", "ask"])
                .optional()
                .describe(
                  "Strategy when destination exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'"
                ),
            })
          )
          .describe(
            "Array of copy operations. Each item specifies source path, destination path, and optional conflict strategy."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
      },
    },
    async (args) => wrap(() => handleBatchCopy(args))
  );

  server.registerTool(
    "create_directory",
    {
      description:
        "Create a new directory (folder) in SMH. Automatically creates intermediate parent directories as needed. Requires admin, space_admin, or create_directory permission.",
      inputSchema: {
        dirPath: z
          .string()
          .describe(
            "Path of the directory to create in SMH. Must NOT start with '/'. Example: 'folder/subfolder/newdir'. Intermediate directories will be created automatically."
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        conflictResolutionStrategy: z
          .enum(["ask", "rename"])
          .default("ask")
          .describe(
            "Strategy when directory already exists: 'ask' (return error on conflict), 'rename' (auto-rename). Default: 'ask'"
          ),
      },
    },
    async (args) => wrap(() => handleCreateDirectory(args))
  );

  server.registerTool(
    "search_files",
    {
      description:
        "Search for files and directories in SMH by keywords or filter conditions (e.g., file size, modification time, extension). Supports filename search and full-text content search. When filtering by size/time only, keywords can be omitted. Returns matching files with metadata. Supports pagination.",
      inputSchema: {
        keywords: z
          .union([z.string(), z.array(z.string())])
          .optional()
          .describe(
            "Search keywords. Can be a single string or an array of strings (OR relationship between array elements). Example: 'report' or ['report', 'summary']. Can be omitted when filtering by file size, modification time, or other conditions only."
          ),
        type: z
          .enum(["filename", "filecontent"])
          .default("filename")
          .describe(
            "Search mode: 'filename' (match by file name, default) or 'filecontent' (full-text search by file content)"
          ),
        spaceId: z
          .string()
          .optional()
          .describe(
            "Space ID (optional, uses default from config if not provided)"
          ),
        scope: z
          .string()
          .optional()
          .describe(
            "Search scope - limit search to a specific directory path. Must NOT start with '/'. Example: 'docs/reports'. Omit to search entire space."
          ),
        limit: z
          .number()
          .min(1)
          .max(100)
          .default(20)
          .describe(
            "Maximum number of results to return (default: 20, range: 1-100)"
          ),
        marker: z
          .string()
          .optional()
          .describe(
            "Pagination marker from previous response for fetching next page"
          ),
        fileTypes: z
          .array(z.enum(["dir", "file"]))
          .optional()
          .describe(
            "Filter by file type: 'dir' for directories only, 'file' for files only. Omit to return all."
          ),
        inExtnames: z
          .array(z.string())
          .optional()
          .describe(
            "Filter by file extensions (OR relationship). Example: ['pdf', 'docx', 'txt']"
          ),
        excludeExtnames: z
          .array(z.string())
          .optional()
          .describe(
            "Exclude file extensions (AND relationship). Example: ['tmp', 'log']"
          ),
        minFileSize: z
          .number()
          .optional()
          .describe(
            "Minimum file size in bytes. Example: 104857600 for 100MB"
          ),
        maxFileSize: z
          .number()
          .optional()
          .describe(
            "Maximum file size in bytes. Example: 1073741824 for 1GB"
          ),
        modificationTimeStart: z
          .string()
          .optional()
          .describe(
            "Filter by modification time start (RFC3339 format). Example: '2024-01-01T00:00:00+08:00'"
          ),
        modificationTimeEnd: z
          .string()
          .optional()
          .describe(
            "Filter by modification time end (RFC3339 format). Example: '2024-12-31T23:59:59+08:00'"
          ),
        orderBy: z
          .enum(["name", "modificationTime", "size", "creationTime", "localCreationTime", "localModificationTime"])
          .optional()
          .describe(
            "Sort field for search results. Note: current version may not fully support sorting."
          ),
        orderByType: z
          .enum(["asc", "desc"])
          .optional()
          .describe(
            "Sort direction: 'asc' (ascending) or 'desc' (descending)"
          ),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Filter by file labels (OR relationship). Example: ['important', 'archived']"
          ),
        categories: z
          .array(z.string())
          .optional()
          .describe(
            "Filter by file categories (OR relationship). Must be declared categories in the media library."
          ),
      },
    },
    async (args) => wrap(() => handleSearchFiles(args))
  );

  server.registerTool(
    "reset_client",
    {
      description:
        "Reset the SMH client connection and clear cached credentials. Use this tool when you encounter authentication errors (e.g., expired or invalid access token). After resetting, subsequent operations will re-initialize the client with fresh configuration from environment variables.",
      inputSchema: {},
    },
    async () => {
      resetSMHClient();
      return ok({
        success: true,
        message:
          "SMH client has been reset. If the token has expired, please update the SMH_ACCESS_TOKEN or SMH_LIBRARY_SECRET environment variable and restart the MCP server.",
      });
    }
  );
}
