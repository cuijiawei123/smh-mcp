# Changelog

本文件记录 smh-mcp 各版本的变更内容。

## [1.0.0] - 2025-06-01

### 🎉 Initial Release

基于 MCP 协议的腾讯云智能媒资托管（SMH）MCP Server 首个正式版本发布。

### Added

#### 核心能力
- 支持 **stdio** 和 **Streamable HTTP** 两种传输模式
- 双鉴权模式：`librarySecret`（自动签发/续期）和 `accessToken`（keepalive 续期）
- Token 自动续期与失效重试机制
- 路径安全校验，防止目录穿越攻击

#### 文件操作工具（16 个）
- `create_upload_task` — 上传本地文件到 SMH 云端，支持分片上传、秒传、冲突策略
- `create_download_task` — 从 SMH 云端下载文件到本地，支持分片下载
- `rename_file` — 重命名或移动文件
- `copy_file` — 复制文件到新位置
- `move_file` — 移动文件到其他目录
- `delete_file` — 删除文件或目录（支持回收站/永久删除）
- `list_directory` — 列出目录内容，支持分页、排序、过滤
- `create_directory` — 创建目录，自动创建中间父目录
- `info_file_or_directory` — 获取文件或目录的详细元信息
- `search_files` — 按关键字搜索文件，支持文件名搜索和全文内容搜索
- `batch_delete` — 批量删除多个文件或目录
- `batch_move` — 批量移动多个文件或目录
- `batch_copy` — 批量复制多个文件或目录
- `list_recycled_items` — 列出回收站中的已删除项目
- `restore_from_recycle_bin` — 从回收站恢复已删除的文件或目录
- `reset_client` — 重置客户端连接，清除缓存凭证

[1.0.0]: https://cnb.cool/tencent/cloud/smh/smh-mcp/-/releases/tag/v1.0.0
