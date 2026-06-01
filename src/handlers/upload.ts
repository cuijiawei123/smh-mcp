import * as fs from "fs";
import { getAccessToken } from "../auth/token-manager.js";
import { getSMHClient, requireConfig } from "../client.js";
import { clampNumber, requireString, resolveLocalPath, stripLeadingSlash } from "../utils/index.js";

export async function handleCreateUploadTask(args: any): Promise<any> {
  const localPath = requireString(args?.localPath, "localPath");
  const remotePath = stripLeadingSlash(requireString(args?.remotePath, "remotePath"));
  const spaceId: string | undefined = args?.spaceId;
  const chunkSize = clampNumber(args?.chunkSize, 1, 100, 10);
  const multipartThreshold = clampNumber(args?.multipartThreshold, 1, 1024, 32);
  const parallel = clampNumber(args?.parallel, 1, 10, 3);
  const enableInstantUpload: boolean = args?.enableInstantUpload !== false;
  const conflictResolutionStrategy: 'ask' | 'rename' | 'overwrite' =
    args?.conflictResolutionStrategy || 'overwrite';

  const absolutePath = resolveLocalPath(localPath);
  try {
    await fs.promises.access(absolutePath);
  } catch {
    throw new Error(`本地文件不存在：${absolutePath}`);
  }

  const fileStats = await fs.promises.stat(absolutePath);
  const fileSize = fileStats.size;
  const config = requireConfig();
  const client = getSMHClient();

  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const task = await client.createUploadTask({
      spaceId: targetSpaceId,
      userId: config.userId,
      filePath: remotePath,
      localPath: absolutePath,
      enableInstantUpload,
      chunkSize,
      parallel,
      partFileSize: multipartThreshold,
      conflictResolutionStrategy,
      verbose: false,
    });

    await task.start();

    const fileInfo = await client.file.infoFile({
      spaceId: targetSpaceId,
      filePath: remotePath,
      info: 1,
      accessToken,
    });

    return {
      success: true,
      message: "上传成功",
      task: {
        localPath: absolutePath,
        remotePath,
        fileSize,
        chunkSize,
        multipartThreshold,
        parallel,
      },
      fileInfo: fileInfo.data,
    };
  } catch (error: any) {
    throw new Error(`上传失败：${error?.message ?? String(error)}`);
  }
}
