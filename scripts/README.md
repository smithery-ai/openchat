# Debug Scripts

Utility scripts for debugging Smithery API integration issues.

## Available Scripts

### 1. Check Environment Configuration

Verifies that all required environment variables are set correctly.

```bash
pnpm debug:env
```

This will check:
- ✅ `SMITHERY_API_KEY` is set
- ✅ `NEXT_PUBLIC_SMITHERY_API_URL` is set (or using default)
- Other environment variables

### 2. Debug Smithery API

Comprehensive test of Smithery API connectivity and functionality.

```bash
# Test basic connectivity, namespaces, tokens, and list connections
pnpm debug:smithery

# Test a specific connection (e.g., gmail)
pnpm debug:connection gmail
```

This will:
- ✅ Test API connectivity
- ✅ List available namespaces
- ✅ Test token creation
- ✅ List all existing connections
- ✅ Test specific connection if provided (creates it if it doesn't exist)
- ✅ Show detailed error messages for debugging

### 3. Test Server Connection

Search for MCP servers by name, connect to them, and display all available tools.

```bash
# Search for a server and connect (creates new, deletes after)
pnpm debug:test-server gmail

# Use a direct MCP URL
pnpm debug:test-server https://mcp.notion.com/mcp

# Reuse existing connection if found
pnpm debug:test-server gmail --reuse

# Keep connection after testing
pnpm debug:test-server gmail --keep

# Error if connection already exists
pnpm debug:test-server gmail --error
```

**Connection Mode Options:**
- `--reuse` - Reuse existing connection if found
- `--error` - Error if connection already exists
- (default) - Warn if exists, then create new

**Cleanup Options:**
- `--keep` - Keep connection after testing
- (default) - Delete connection after testing (only deletes newly created ones)

This will:
- ✅ Search the Smithery server directory by name
- ✅ Display matching servers with details
- ✅ Create a new connection (or reuse with `--reuse`)
- ✅ Fetch and display all available tools
- ✅ Show tool names and descriptions
- ✅ Handle authentication requirements gracefully
- ✅ Clean up connection after testing (unless `--keep`)

## Common Issues and Solutions

### Issue: "Initialization failed with status 500"

This is a server-side error from the Smithery API. To diagnose:

1. Check if the server is available:
   ```bash
   pnpm debug:connection gmail
   ```

2. Look at the connection status and message in the output

3. Common causes:
   - The MCP server might be temporarily down
   - The server might require authentication (check for `auth_required` status)
   - The server might have a configuration issue

### Issue: "API connection failed"

Check your environment configuration:

```bash
pnpm debug:env
```

Make sure:
- `SMITHERY_API_KEY` is set in your `.env` file
- The API key has the correct permissions
- `NEXT_PUBLIC_SMITHERY_API_URL` points to the correct endpoint (if not using default)

### Issue: "No namespaces found"

You need to create a namespace in the Smithery dashboard first. Visit [smithery.ai](https://smithery.ai) and create a namespace.

## Debug Output Explanation

The debug scripts use emoji indicators:

- ✅ Success - operation completed successfully
- ❌ Error - operation failed, check the error message
- ⚠️ Warning - operation completed but with warnings
- 🔍 Info - informational message about what's being tested

## Examples

### Testing Gmail Connection

```bash
$ pnpm debug:connection gmail

🚀 Smithery API Debug Tool
============================

🔍 Testing basic API connectivity...
   Base URL: https://api.smithery.ai
✅ API connection successful
   Namespaces found: 1
   Default namespace: my-namespace

🔍 Testing token creation...
✅ Token created successfully
   Token: sk_test_abc123...
   Expires: 2026-02-02T16:00:00Z

🔍 Listing existing connections...
✅ Found 2 connections

   Connection: Gmail
   - ID: gmail
   - URL: https://server.smithery.ai/gmail/mcp
   - Status: error
   - Message: Initialization failed with status 500

🔍 Testing connection: gmail...
   Status: error
   URL: https://server.smithery.ai/gmail/mcp
   Message: Initialization failed with status 500

   Attempting to call tools/list...
❌ Connection test failed
   Error: Server returned error status
   HTTP Status: 500

✨ Debug complete!
```

This output shows that Gmail connection exists but is returning a 500 error, indicating a server-side issue with the Gmail MCP server on Smithery.

### Testing Server Connection with Tool Discovery

```bash
$ pnpm debug:test-server exa

🚀 MCP Server Connection Test
==============================

📁 Using namespace: my-namespace

🔍 Searching for servers matching: exa
✅ Found 1 server(s)

📦 Server: Exa
   Name: exa
   URL: https://server.smithery.ai/exa/mcp
   Description: Search the web with Exa AI

📌 Selected: Exa

🔗 Creating connection...
   Connection ID: exa
   MCP URL: https://server.smithery.ai/exa/mcp
✅ Connection created: exa
   Status: connected

🛠️  Fetching available tools...
✅ Available Tools (3):

   1. exa_search
      Search the web using Exa AI

   2. exa_find_similar
      Find web pages similar to a given URL

   3. exa_get_contents
      Get the contents of a web page

✨ Connection test complete!
```

## Adding New Debug Scripts

To add new debug utilities:

1. Create a new `.ts` file in the `scripts/` directory
2. Add `#!/usr/bin/env tsx` at the top
3. Add a script entry in `package.json`
4. Document it in this README
