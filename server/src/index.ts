#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  forgetShape,
  handleForget,
  handleList,
  handleRecall,
  handleSaveMemory,
  handleSearch,
  listShape,
  memoryStore,
  recallShape,
  saveMemoryShape,
  searchShape,
} from "./tools.js";

async function main(): Promise<void> {
  await memoryStore.init();

  const server = new McpServer({
    name: "echo",
    version: "0.1.0",
  });

  server.tool(
    "save_memory",
    "Save a new memory or update an existing one by id. Use stable kebab-case ids.",
    saveMemoryShape,
    handleSaveMemory,
  );

  server.tool(
    "recall",
    "Recall the full content of a memory by id.",
    recallShape,
    handleRecall,
  );

  server.tool(
    "search",
    "Free-text search across all memories. Returns ranked results with snippets.",
    searchShape,
    handleSearch,
  );

  server.tool(
    "list_by_category",
    "List memories, optionally filtered by category, sorted by freshness.",
    listShape,
    handleList,
  );

  server.tool(
    "forget",
    "Delete a memory by id. Returns false if no such memory exists.",
    forgetShape,
    handleForget,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Echo MCP server running on stdio");
}

main().catch((err) => {
  console.error("Echo failed to start:", err);
  process.exit(1);
});
