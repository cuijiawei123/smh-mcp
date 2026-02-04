# SMH MCP Server

A Model Context Protocol (MCP) server for interacting with Tencent Cloud Smart Media Hub (SMH).

## Features

- 📤 Advanced file upload with progress tracking
- 📥 Advanced file download with progress tracking  
- 🔄 Rename and move files in SMH storage
- 📊 Configurable chunk size and parallel operations
- 🎯 Support for both instant upload and chunked upload

## Installation

### 1. Install Dependencies

```bash
cd mcp-smh
npm install
```

### 2. Build the Project

```bash
npm run build
```

## Configuration

Set the following environment variables:

```bash
# SMH API endpoint (optional, defaults to https://api.tencentsmh.cn)
export SMH_BASE_PATH="https://api.tencentsmh.cn"

# Your SMH Access Token (required)
export SMH_ACCESS_TOKEN="your_access_token"

# Your SMH Library ID (required)
export SMH_LIBRARY_ID="your_library_id"

# Target Space ID (required)
export SMH_SPACE_ID="your_space_id"

# User ID (optional, defaults to "mcp-user")
export SMH_USER_ID="your_user_id"
```

### Configuration File (Optional)

Create a `.env` file in the project root:

```env
SMH_BASE_PATH=https://api.tencentsmh.cn
SMH_ACCESS_TOKEN=your_access_token
SMH_LIBRARY_ID=your_library_id
SMH_SPACE_ID=your_space_id
SMH_USER_ID=mcp-user
```

## Available Tools

### 1. `create_upload_task`

Create an advanced upload task with progress tracking and detailed controls. This method is recommended for uploading very large files or when you need to monitor upload progress.

**Parameters:**
- `localPath` (required): Absolute or relative path to the local file
- `remotePath` (required): Destination path in SMH (e.g., '/folder/filename.ext')
- `spaceId` (optional): Space ID where the file will be uploaded (uses default from config if not provided)
- `chunkSize` (optional): Chunk size in MB for large file upload (default: 10, range: 1-100)
- `parallel` (optional): Number of parallel upload tasks (default: 3, range: 1-10)
- `enableInstantUpload` (optional): Enable instant upload for small files (default: true)

**Example:**
```json
{
  "localPath": "./large-file.txt",
  "remotePath": "/uploads/large-file.txt",
  "chunkSize": 10,
  "parallel": 3,
  "enableInstantUpload": true
}
```

### 2. `rename_file`

Rename or move a file in SMH. Can be used to rename a file or move it to a different directory.

**Parameters:**
- `sourcePath` (required): Current path of the file in SMH (e.g., '/folder/oldname.ext')
- `destinationPath` (required): New path for the file in SMH (e.g., '/folder/newname.ext' or '/newfolder/filename.ext')
- `spaceId` (optional): Space ID where the file is located (uses default from config if not provided)
- `conflictResolutionStrategy` (optional): Strategy when destination file already exists: 'rename' (auto-rename), 'overwrite' (replace), 'ask' (return error). Default: 'rename'

**Example:**
```json
{
  "sourcePath": "/folder/oldname.txt",
  "destinationPath": "/folder/newname.txt",
  "conflictResolutionStrategy": "rename"
}
```

### 3. `create_download_task`

Create an advanced download task with progress tracking and detailed controls. This method is recommended for downloading very large files or when you need to monitor download progress.

**Parameters:**
- `remotePath` (required): Path of the file in SMH to download (e.g., '/folder/filename.ext')
- `localPath` (required): Local destination path where the file will be saved
- `spaceId` (optional): Space ID where the file is located (uses default from config if not provided)
- `chunkSize` (optional): Chunk size in MB for large file download (default: 10, range: 1-100)
- `parallel` (optional): Number of parallel download tasks (default: 3, range: 1-10)
- `overwrite` (optional): Whether to overwrite if local file already exists (default: false)

**Example:**
```json
{
  "remotePath": "/uploads/large-file.txt",
  "localPath": "./downloaded-file.txt",
  "chunkSize": 10,
  "parallel": 3,
  "overwrite": false
}
```

## Usage with MCP Clients

### Claude Desktop

Add the following to your Claude Desktop MCP configuration file:

```json
{
  "mcpServers": {
    "smh": {
      "command": "node",
      "args": [
        "/Users/juanjuanlong/Desktop/smh/mcp-smh/dist/index.js"
      ],
      "env": {
        "SMH_BASE_PATH": "https://api.tencentsmh.cn",
        "SMH_ACCESS_TOKEN": "your_access_token",
        "SMH_LIBRARY_ID": "your_library_id",
        "SMH_SPACE_ID": "your_space_id",
        "SMH_USER_ID": "mcp-user"
      }
    }
  }
}
```

### Cline (VS Code Extension)

Add to your Cline MCP settings:

```json
{
  "mcpServers": {
    "smh": {
      "command": "node",
      "args": [
        "/Users/juanjuanlong/Desktop/smh/mcp-smh/dist/index.js"
      ],
      "env": {
        "SMH_ACCESS_TOKEN": "your_access_token",
        "SMH_LIBRARY_ID": "your_library_id",
        "SMH_SPACE_ID": "your_space_id"
      }
    }
  }
}
```

## Development

### Watch Mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Start Server

```bash
npm start
```

## Example Usage

Once configured, you can use the tools in Claude:

```
User: Upload the file ./test-file.txt to SMH at path /uploads/test-file.txt
```

```
User: Download the file /uploads/document.pdf to ./local-document.pdf
```

```
User: Rename /folder/oldname.txt to /folder/newname.txt
```

The MCP server will handle the operations with progress tracking and error handling.

## Error Handling

The server handles common errors:
- File not found locally or remotely
- Invalid credentials or permissions
- Network failures (with automatic retry)
- Space or path not found
- File conflicts during rename operations

## License

ISC
