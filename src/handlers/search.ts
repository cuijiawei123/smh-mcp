import { getAccessToken } from "../auth/token-manager.js";
import { getSMHClient, requireConfig } from "../client.js";
import { clampNumber, stripLeadingSlash } from "../utils/index.js";

export async function handleSearchFiles(args: any): Promise<any> {
  let keywords: string[] | undefined;
  if (args?.keywords) {
    keywords = Array.isArray(args.keywords)
      ? args.keywords
      : [String(args.keywords)];
  }
  const spaceId: string | undefined = args?.spaceId;
  const scope: string | undefined = args?.scope
    ? stripLeadingSlash(args.scope)
    : undefined;
  const type: string = args?.type || "filename";
  const limit: number = clampNumber(args?.limit, 1, 100, 20);
  const marker: string | undefined = args?.marker;
  const fileTypes: string[] | undefined = args?.fileTypes;
  const inExtnames: string[] | undefined = args?.inExtnames;
  const excludeExtnames: string[] | undefined = args?.excludeExtnames;
  const minFileSize: number | undefined = args?.minFileSize;
  const maxFileSize: number | undefined = args?.maxFileSize;
  const modificationTimeStart: string | undefined = args?.modificationTimeStart;
  const modificationTimeEnd: string | undefined = args?.modificationTimeEnd;
  const orderBy: string | undefined = args?.orderBy;
  const orderByType: string | undefined = args?.orderByType;
  const labels: string[] | undefined = args?.labels;
  const categories: string[] | undefined = args?.categories;

  const config = requireConfig();
  const client = getSMHClient();
  const accessToken = await getAccessToken();
  client.setDefaultAccessToken(accessToken);

  const targetSpaceId = spaceId || config.spaceId;

  try {
    const result = await client.search.searchFs({
      spaceId: targetSpaceId,
      accessToken,
      limit,
      marker,
      searchFsRequest: {
        type: type as any,
        ...(keywords && keywords.length > 0 ? { keywords } : {}),
        scope,
        fileTypes: fileTypes as any,
        inExtnames,
        excludeExtnames,
        minFileSize,
        maxFileSize,
        modificationTimeStart,
        modificationTimeEnd,
        orderBy: orderBy as any,
        orderByType: orderByType as any,
        labels,
        categories,
        marker,
      },
    });

    return {
      success: true,
      message: "搜索完成",
      ...(keywords ? { keywords } : {}),
      data: result.data,
    };
  } catch (error: any) {
    throw new Error(`搜索失败：${error?.message ?? String(error)}`);
  }
}
