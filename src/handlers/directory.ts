import { getAccessToken } from "../auth/token-manager.js";
import { getSMHClient, requireConfig } from "../client.js";
import { clampNumber, requireString, stripLeadingSlash } from "../utils/index.js";

export async function handleListDirectory(args: any): Promise<any> {
  const dirPath: string = stripLeadingSlash(args?.dirPath ?? "");
  const spaceId: string | undefined = args?.spaceId;
  const limit: number = clampNumber(args?.limit, 1, 100, 20);
  const marker: string | undefined = args?.marker;
  const orderBy: string | undefined = args?.orderBy;
  const orderByType: string | undefined = args?.orderByType;
  const filter: string | undefined = args?.filter;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.directory.listDirectory({
      spaceId: targetSpaceId,
      filePath: dirPath,
      byMarker: 1 as any,
      marker,
      limit,
      orderBy: orderBy as any,
      orderByType: orderByType as any,
      filter: filter as any,
      accessToken,
    });

    return {
      success: true,
      message: "获取目录列表成功",
      dirPath: dirPath || "/",
      data: result.data,
    };
  } catch (error: any) {
    throw new Error(`获取目录列表失败：${error?.message ?? String(error)}`);
  }
}

export async function handleCreateDirectory(args: any): Promise<any> {
  const dirPath = stripLeadingSlash(requireString(args?.dirPath, "dirPath"));
  const spaceId: string | undefined = args?.spaceId;
  const conflictResolutionStrategy: string = args?.conflictResolutionStrategy || "ask";

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.directory.createDirectory({
      spaceId: targetSpaceId,
      filePath: dirPath,
      conflictResolutionStrategy: conflictResolutionStrategy as any,
      accessToken,
    });

    return {
      success: true,
      message: "创建目录成功",
      dirPath,
      data: result.data,
    };
  } catch (error: any) {
    throw new Error(`创建目录失败：${error?.message ?? String(error)}`);
  }
}

export async function handleInfoFileOrDirectory(args: any): Promise<any> {
  const filePath = stripLeadingSlash(requireString(args?.filePath, "filePath"));
  const spaceId: string | undefined = args?.spaceId;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.directory.infoFileOrDirectory({
      spaceId: targetSpaceId,
      filePath,
      info: 1 as any,
      accessToken,
    });

    return {
      success: true,
      message: "获取详情成功",
      filePath,
      data: result.data,
    };
  } catch (error: any) {
    throw new Error(`获取详情失败：${error?.message ?? String(error)}`);
  }
}
