/**
 * Detect SMH "InvalidAccessToken" (HTTP 403) responses.
 */
export function isInvalidAccessTokenError(error: any): boolean {
  const status = error?.response?.status ?? error?.status;
  const data = error?.response?.data ?? error?.data;
  const code: string | undefined =
    data?.code ?? data?.error?.code ?? data?.Code;
  const message: string =
    data?.message ?? data?.error?.message ?? error?.message ?? "";
  if (
    status === 403 &&
    (code === "InvalidAccessToken" || /InvalidAccessToken/i.test(message))
  ) {
    return true;
  }
  return false;
}
