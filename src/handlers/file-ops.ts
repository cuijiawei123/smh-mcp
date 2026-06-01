import { getAccessToken } from "../auth/token-manager.js";
import { getSMHClient, requireConfig } from "../client.js";
import { requireString, stripLeadingSlash } from "../utils/index.js";

type ConflictStrategy = "rename" | "overwrite" | "ask";

async function prepare(
  args: any,
  opName: string
): Promise<{
  client: ReturnType<typeof getSMHClient>;
  accessToken: string;
  targetSpaceId: string;
  sourcePath: string;
  destinationPath: string;
  conflictResolutionStrategy: ConflictStrategy;
}> {
  const sourcePath = stripLeadingSlash(requireString(args?.sourcePath, "sourcePath"));
  const destinationPath = stripLeadingSlash(
    requireString(args?.destinationPath, "destinationPath")
  );
  const spaceId: string | undefined = args?.spaceId;
  const conflictResolutionStrategy: ConflictStrategy =
    args?.conflictResolutionStrategy ?? "rename";

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  return {
    client,
    accessToken,
    targetSpaceId,
    sourcePath,
    destinationPath,
    conflictResolutionStrategy,
  };
}

export async function handleRenameFile(args: any): Promise<any> {
  const {
    client,
    accessToken,
    targetSpaceId,
    sourcePath,
    destinationPath,
    conflictResolutionStrategy,
  } = await prepare(args, "Renaming file");

  try {
    const result = await client.file.moveFile({
      spaceId: targetSpaceId,
      filePath: destinationPath,
      accessToken,
      moveFileRequest: { from: sourcePath },
      conflictResolutionStrategy,
    });

    return {
      success: true,
      message: "重命名成功",
      sourcePath,
      destinationPath,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`重命名失败：${error?.message ?? String(error)}`);
  }
}

export async function handleCopyFile(args: any): Promise<any> {
  const {
    client,
    accessToken,
    targetSpaceId,
    sourcePath,
    destinationPath,
    conflictResolutionStrategy,
  } = await prepare(args, "Copying file");

  try {
    const result = await client.file.copyFile({
      spaceId: targetSpaceId,
      filePath: destinationPath,
      accessToken,
      copyFileRequest: { copyFrom: sourcePath },
      conflictResolutionStrategy,
    });

    return {
      success: true,
      message: "复制成功",
      sourcePath,
      destinationPath,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`复制失败：${error?.message ?? String(error)}`);
  }
}

export async function handleMoveFile(args: any): Promise<any> {
  const {
    client,
    accessToken,
    targetSpaceId,
    sourcePath,
    destinationPath,
    conflictResolutionStrategy,
  } = await prepare(args, "Moving file");

  try {
    const result = await client.file.moveFile({
      spaceId: targetSpaceId,
      filePath: destinationPath,
      accessToken,
      moveFileRequest: { from: sourcePath },
      conflictResolutionStrategy,
    });

    return {
      success: true,
      message: "移动成功",
      sourcePath,
      destinationPath,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`移动失败：${error?.message ?? String(error)}`);
  }
}

export async function handleDeleteFile(args: any): Promise<any> {
  const filePath = stripLeadingSlash(requireString(args?.filePath, "filePath"));
  const spaceId: string | undefined = args?.spaceId;
  const permanent: boolean = args?.permanent ?? false;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.file.deleteFile({
      libraryId: config.libraryId,
      spaceId: targetSpaceId,
      filePath,
      accessToken,
      permanent: permanent ? 1 : 0,
    });

    return {
      success: true,
      message: permanent ? "永久删除成功" : "已移入回收站",
      filePath,
      permanent,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`删除失败：${error?.message ?? String(error)}`);
  }
}

export async function handleListRecycledItems(args: any): Promise<any> {
  const spaceId: string | undefined = args?.spaceId;
  const limit: number = args?.limit ?? 20;
  const marker: string | undefined = args?.marker;
  const orderBy: string | undefined = args?.orderBy;
  const orderByType: string | undefined = args?.orderByType;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.recycled.recycleList({
      libraryId: config.libraryId,
      spaceId: targetSpaceId,
      byMarker: 1,
      marker,
      limit,
      orderBy: orderBy as any,
      orderByType: orderByType as any,
      accessToken,
    });

    return {
      success: true,
      message: "获取回收站列表成功",
      data: result.data,
    };
  } catch (error: any) {
    throw new Error(`获取回收站列表失败：${error?.message ?? String(error)}`);
  }
}

export async function handleRestoreRecycledItem(args: any): Promise<any> {
  const recycledItemId: number = args?.recycledItemId;
  if (!recycledItemId && recycledItemId !== 0) {
    throw new Error("recycledItemId is required");
  }
  const spaceId: string | undefined = args?.spaceId;
  const conflictResolutionStrategy: string = args?.conflictResolutionStrategy ?? "ask";
  const restorePathStrategy: string = args?.restorePathStrategy ?? "originalPath";

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.recycled.recycleRestore({
      libraryId: config.libraryId,
      spaceId: targetSpaceId,
      recycledItemId,
      restore: 1,
      conflictResolutionStrategy: conflictResolutionStrategy as any,
      accessToken,
      restorePathStrategy: restorePathStrategy as any,
    });

    return {
      success: true,
      message: "恢复成功",
      recycledItemId,
      result: result.data,
    };
  } catch (error: any) {
    throw new Error(`恢复失败：${error?.message ?? String(error)}`);
  }
}

export async function handleBatchDelete(args: any): Promise<any> {
  const items: Array<{ path: string; permanent?: boolean }> = args?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("参数错误：'items' 必须是非空数组");
  }
  const spaceId: string | undefined = args?.spaceId;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  const batchDeleteRequest = items.map((item) => ({
    path: stripLeadingSlash(requireString(item.path, "items[].path")),
    permanent: item.permanent ?? false,
  }));

  try {
    const result = await client.batchDeleteWithAsync({
      spaceId: targetSpaceId,
      accessToken,
      batchDeleteRequest,
    });

    return {
      success: true,
      message: `批量删除完成，共 ${items.length} 个项目`,
      totalItems: items.length,
      result,
    };
  } catch (error: any) {
    throw new Error(`批量删除失败：${error?.message ?? String(error)}`);
  }
}

export async function handleBatchMove(args: any): Promise<any> {
  const items: Array<{
    from: string;
    to: string;
    conflictResolutionStrategy?: string;
  }> = args?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("参数错误：'items' 必须是非空数组");
  }
  const spaceId: string | undefined = args?.spaceId;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  const batchMoveRequest = items.map((item) => ({
    from: stripLeadingSlash(requireString(item.from, "items[].from")),
    to: stripLeadingSlash(requireString(item.to, "items[].to")),
    conflictResolutionStrategy: (item.conflictResolutionStrategy ?? "rename") as any,
  }));

  try {
    const result = await client.batchMoveWithAsync({
      spaceId: targetSpaceId,
      accessToken,
      batchMoveRequest,
    });

    return {
      success: true,
      message: `批量移动完成，共 ${items.length} 个项目`,
      totalItems: items.length,
      result,
    };
  } catch (error: any) {
    throw new Error(`批量移动失败：${error?.message ?? String(error)}`);
  }
}

export async function handleBatchCopy(args: any): Promise<any> {
  const items: Array<{
    copyFrom: string;
    to: string;
    conflictResolutionStrategy?: string;
  }> = args?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("参数错误：'items' 必须是非空数组");
  }
  const spaceId: string | undefined = args?.spaceId;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  const batchCopyRequest = items.map((item) => ({
    copyFrom: stripLeadingSlash(requireString(item.copyFrom, "items[].copyFrom")),
    to: stripLeadingSlash(requireString(item.to, "items[].to")),
    conflictResolutionStrategy: (item.conflictResolutionStrategy ?? "rename") as any,
  }));

  try {
    const result = await client.batchCopyWithAsync({
      spaceId: targetSpaceId,
      accessToken,
      batchCopyRequest,
    });

    return {
      success: true,
      message: `批量复制完成，共 ${items.length} 个项目`,
      totalItems: items.length,
      result,
    };
  } catch (error: any) {
    throw new Error(`批量复制失败：${error?.message ?? String(error)}`);
  }
}
