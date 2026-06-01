import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSmhPrompts(server: McpServer): void {
  server.registerPrompt(
    "quickstart",
    {
      description:
        "Quick start guide for SMH MCP service - shows available tools and usage examples",
    },
    async () => ({
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# SMH MCP 服务 - 快速入门

## 重要：路径格式
- 所有远程路径（remotePath、sourcePath、destinationPath、filePath、dirPath）**不要以 \`/\` 开头**
- 使用 \`/\` 分隔多级目录，例如 \`docs/file.pdf\`
- 根目录使用空字符串

## 可用工具

### 1. 文件上传 - create_upload_task
上传本地文件到 SMH 云端，支持分片上传和秒传。
\`\`\`
工具：create_upload_task
参数：localPath="/path/to/file.pdf", remotePath="docs/file.pdf"（可选 conflictResolutionStrategy="overwrite" 覆盖同名文件，或 "rename" 自动重命名）
\`\`\`

### 2. 文件下载 - create_download_task
从 SMH 云端下载文件到本地，支持分片下载。
\`\`\`
工具：create_download_task
参数：remotePath="docs/file.pdf", localPath="/path/to/save/file.pdf"
\`\`\`

### 3. 重命名/移动文件 - rename_file
重命名或移动 SMH 中的文件。
\`\`\`
工具：rename_file
参数：sourcePath="docs/old.pdf", destinationPath="docs/new.pdf"
\`\`\`

### 4. 复制文件 - copy_file
复制 SMH 中的文件到新位置，原文件保持不变。
\`\`\`
工具：copy_file
参数：sourcePath="docs/file.pdf", destinationPath="backup/file.pdf"
\`\`\`

### 5. 移动文件 - move_file
移动 SMH 中的文件到其他目录，原位置文件将被移除。
\`\`\`
工具：move_file
参数：sourcePath="docs/file.pdf", destinationPath="archive/file.pdf"
\`\`\`

### 6. 列出目录内容 - list_directory
列出 SMH 中某个目录下的文件和子目录。
\`\`\`
工具：list_directory
参数：dirPath="docs"（留空则列出根目录）
\`\`\`

### 7. 查看文件/目录详情 - info_file_or_directory
获取文件或目录的详细信息（大小、修改时间、类型等）。
\`\`\`
工具：info_file_or_directory
参数：filePath="docs/file.pdf"
\`\`\`

### 8. 创建目录 - create_directory
在 SMH 中创建新目录，自动创建中间父目录。
\`\`\`
工具：create_directory
参数：dirPath="docs/reports/2024"（可选 conflictResolutionStrategy="rename" 自动重命名）
\`\`\`

### 9. 搜索文件 - search_files
按关键字或条件搜索 SMH 中的文件和目录，支持文件名搜索、全文内容搜索，以及按文件大小、修改时间、标签、分类等条件过滤。
\`\`\`
工具：search_files
参数：keywords="报告"（可选 type="filecontent" 全文搜索，scope="docs" 限定搜索范围）
按文件大小过滤：minFileSize=104857600（100MB，单位为字节），maxFileSize 同理，此时 keywords 可不传
按修改时间过滤：modificationTimeStart="2024-01-01T00:00:00+08:00", modificationTimeEnd="2024-12-31T23:59:59+08:00"
按文件后缀过滤：inExtnames=["pdf","docx"]（只搜索指定后缀），excludeExtnames=["tmp","log"]（排除指定后缀）
排序：orderBy="size"（可选 name/modificationTime/size/creationTime），orderByType="desc"（asc 升序/desc 降序）
按标签过滤：labels=["重要","归档"]
按分类过滤：categories=["文档","图片"]
\`\`\`
### 10. 删除文件/目录 - delete_file
删除 SMH 中的文件或目录。默认移入回收站，设置 permanent=true 则永久删除。
\`\`\`
工具：delete_file
参数：filePath="docs/file.pdf"（可选 permanent=true 永久删除）
\`\`\`

### 11. 批量删除 - batch_delete
批量删除多个文件或目录，支持混合永久删除和移入回收站。
\`\`\`
工具：batch_delete
参数：items=[{"path": "docs/file1.pdf"}, {"path": "docs/file2.pdf", "permanent": true}]
\`\`\`

### 12. 批量移动/批量重命名 - batch_move
批量移动多个文件或目录到新位置。也可用于批量重命名：将 from 和 to 设为同目录下的不同文件名即可实现重命名效果。
\`\`\`
工具：batch_move
批量移动：items=[{"from": "docs/file1.pdf", "to": "archive/file1.pdf"}, {"from": "docs/file2.pdf", "to": "archive/file2.pdf"}]
批量重命名：items=[{"from": "docs/old1.pdf", "to": "docs/new1.pdf"}, {"from": "docs/old2.pdf", "to": "docs/new2.pdf"}]
\`\`\`

### 13. 批量复制 - batch_copy
批量复制多个文件或目录到新位置，原文件保持不变。
\`\`\`
工具：batch_copy
参数：items=[{"copyFrom": "docs/file1.pdf", "to": "backup/file1.pdf"}, {"copyFrom": "docs/file2.pdf", "to": "backup/file2.pdf"}]
\`\`\`

### 14. 列出回收站内容 - list_recycled_items
列出回收站中被删除的文件和目录，获取 recycledItemId 用于恢复操作。
\`\`\`
工具：list_recycled_items
参数：limit=20（可选 orderBy="removalTime", orderByType="desc"）
\`\`\`

### 15. 从回收站恢复文件 - restore_from_recycle_bin
将误删的文件或目录从回收站恢复到原始位置。需先使用 list_recycled_items 获取 recycledItemId。
\`\`\`
工具：restore_from_recycle_bin
参数：recycledItemId=12345（可选 conflictResolutionStrategy="rename", restorePathStrategy="fallbackToRoot"）
\`\`\`

### 16. 重置客户端连接 - reset_client
当遇到认证错误（如 Token 过期或无效）时，重置 SMH 客户端并清除缓存凭证。
\`\`\`
工具：reset_client
参数：无
\`\`\`
重置后，如果 Token 已过期，需要更新环境变量（SMH_ACCESS_TOKEN 或 SMH_LIBRARY_SECRET）并重启 MCP Server。

## 提示
- 所有远程路径**不要以 \`/\` 开头**，使用 \`/\` 分隔多级目录
- 根目录使用空字符串
- spaceId 参数可选，不传则使用环境变量中配置的默认值

## 自动行为规则
当用户消息中包含以下关键词时，直接调用 search_files 工具进行搜索，无需额外确认：
- 中文关键词：查找、搜索、找一下、搜一下、查一下、有没有、在哪里、哪个文件、找到
- 英文关键词：find、search、locate、where is

处理方式：
1. 从用户消息中提取搜索目标作为 keywords 参数
2. 如果用户指定了目录范围，使用 scope 参数限定
3. 如果用户明确要求搜索文件内容，使用 type="filecontent"
4. 默认使用文件名搜索（type="filename"）
5. 如果用户要求按大小、时间等条件过滤，使用对应的过滤参数，此时 keywords 可不传
6. 如果用户要求排序结果，使用 orderBy 和 orderByType 参数

示例：
- 用户说"查找报告" -> 调用 search_files(keywords="报告")
- 用户说"搜索合同文件" -> 调用 search_files(keywords="合同")
- 用户说"docs目录下有没有PDF" -> 调用 search_files(keywords="PDF", scope="docs")
- 用户说"查找包含预算的文件内容" -> 调用 search_files(keywords="预算", type="filecontent")
- 用户说"查找大于100MB的文件" -> 调用 search_files(minFileSize=104857600, scope="目录路径")
- 用户说"找test目录下超过1GB的文件" -> 调用 search_files(minFileSize=1073741824, scope="test")
- 用户说"按大小排序查找文件" -> 调用 search_files(orderBy="size", orderByType="desc")
- 用户说"查找标签为重要的文件" -> 调用 search_files(labels=["重要"])
- 用户说"只搜索PDF和Word文件" -> 调用 search_files(keywords="...", inExtnames=["pdf","docx"])
- 用户说"查找最近修改的文件" -> 调用 search_files(modificationTimeStart="2024-01-01T00:00:00+08:00", orderBy="modificationTime", orderByType="desc")

### 整理文件规则
当用户消息中包含以下关键词时，执行文件整理操作：
- 中文关键词：整理、归类、分类、归档、放到、移到、移入、收纳
- 英文关键词：organize、sort、categorize、move to

处理方式：
1. 先使用 search_files 搜索目标文件（根据用户描述的文件类型、后缀、关键词等条件）
2. 确认目标目录是否存在：使用 info_file_or_directory 检查目标目录
3. 如果目标目录不存在，使用 create_directory 自动创建目录
4. 使用 batch_move 将搜索到的文件批量移动到目标目录

常见文件类型与目录映射（用户未指定目录名时可参考）：
- 图片文件（jpg/jpeg/png/gif/bmp/webp/svg/tiff）-> "图片" 或 "images"
- 文档文件（pdf/doc/docx/xls/xlsx/ppt/pptx/txt）-> "文档" 或 "documents"
- 视频文件（mp4/avi/mov/mkv/wmv/flv）-> "视频" 或 "videos"
- 音频文件（mp3/wav/flac/aac/ogg/wma）-> "音频" 或 "audio"
- 压缩文件（zip/rar/7z/tar/gz）-> "压缩包" 或 "archives"

示例：
- 用户说"把图片整理到图片目录下" -> 1. search_files(inExtnames=["jpg","jpeg","png","gif","bmp","webp","svg","tiff"]) 2. create_directory(dirPath="图片") 3. batch_move(items=[...])
- 用户说"将test目录下的PDF归类到文档目录" -> 1. search_files(inExtnames=["pdf"], scope="test") 2. create_directory(dirPath="文档") 3. batch_move(items=[...])
- 用户说"整理docs下的视频文件到视频目录" -> 1. search_files(inExtnames=["mp4","avi","mov","mkv","wmv","flv"], scope="docs") 2. create_directory(dirPath="视频") 3. batch_move(items=[...])
- 用户说"把大于50MB的文件移到大文件目录" -> 1. search_files(minFileSize=52428800) 2. create_directory(dirPath="大文件") 3. batch_move(items=[...])`,
          },
        },
      ],
    })
  );
}
