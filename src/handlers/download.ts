import * as fs from "fs";
import * as path from "path";
import { getAccessToken } from "../auth/token-manager.js";
import { getSMHClient, requireConfig } from "../client.js";
import { clampNumber, requireString, resolveLocalPath, stripLeadingSlash } from "../utils/index.js";

export async function handleCreateDownloadTask(args: any): Promise<any> {
  const remotePath = stripLeadingSlash(requireString(args?.remotePath, "remotePath"));
  const localPath = requireString(args?.localPath, "localPath");
  const spaceId: string | undefined = args?.spaceId;
  const chunkSize = clampNumber(args?.chunkSize, 1, 100, 10);
  const multipartThreshold = clampNumber(args?.multipartThreshold, 1, 1024, 32);
  const parallel = clampNumber(args?.parallel, 1, 10, 3);
  const overwrite: boolean = args?.overwrite === true;

  const absoluteLocalPath = resolveLocalPath(localPath);

  if (!overwrite) {
    try {
      await fs.promises.access(absoluteLocalPath);
      throw new Error(
        `本地文件已存在：${absoluteLocalPath}，如需覆盖请设置 overwrite=true。`
      );
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const destDir = path.dirname(absoluteLocalPath);
  await fs.promises.mkdir(destDir, { recursive: true });

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const task = await client.createDownloadTask({
      spaceId: targetSpaceId,
      userId: config.userId,
      filePath: remotePath,
      localPath: absoluteLocalPath,
      chunkSize,
      partFileSize: multipartThreshold,
      parallel,
      verbose: false,
    });

    await task.start();

    const fileStats = await fs.promises.stat(absoluteLocalPath);

    return {
      success: true,
      message: "下载成功",
      task: {
        remotePath,
        localPath: absoluteLocalPath,
        fileSize: fileStats.size,
        chunkSize,
        multipartThreshold,
        parallel,
      },
    };
  } catch (error: any) {
    throw new Error(`下载失败：${error?.message ?? String(error)}`);
  }
}
