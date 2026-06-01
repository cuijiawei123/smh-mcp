/**
 * 日志
 */
export const logger = {
  /**
 * 输出信息级别的日志，带有 "[smh-mcp]" 前缀标识
 * @returns {void}
 */
info: (...args: unknown[]) => console.error("[smh-mcp]", ...args),
  warn: (...args: unknown[]) => console.error("[smh-mcp][warn]", ...args),
  error: (...args: unknown[]) => console.error("[smh-mcp][error]", ...args),
};
