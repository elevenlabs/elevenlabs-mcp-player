/**
 * Shared utilities for running MCP servers with various transports.
 */

import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";

/**
 * Starts an MCP server using the appropriate transport based on command-line arguments.
 *
 * If `--stdio` is passed, uses stdio transport. Otherwise, uses Streamable HTTP transport.
 *
 * @param createServer - Factory function that creates a new McpServer instance.
 */
export async function startServer(
  createServer: () => McpServer,
): Promise<void> {
  try {
    if (process.argv.includes("--stdio")) {
      await startStdioServer(createServer);
    } else {
      await startStreamableHttpServer(createServer);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 * Starts an MCP server with stdio transport.
 *
 * @param createServer - Factory function that creates a new McpServer instance.
 */
export async function startStdioServer(
  createServer: () => McpServer,
): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

/**
 * Starts an MCP server with Streamable HTTP transport in stateless mode.
 *
 * Each request creates a fresh server and transport instance, which are
 * closed when the response ends (no session tracking).
 *
 * The server listens on the port specified by the PORT environment variable,
 * defaulting to 3001 if not set.
 *
 * @param createServer - Factory function that creates a new McpServer instance per request.
 */
export async function startStreamableHttpServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  // Express app - bind to all interfaces for development/testing
  const expressApp = createMcpExpressApp({ host: "0.0.0.0" });
  expressApp.use(cors());

  // Serve local audio files with Range request support
  expressApp.get("/audio", (req: Request, res: Response) => {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).send("Missing path query parameter");
      return;
    }

    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).send("File not found");
      return;
    }

    const stat = fs.statSync(absolutePath);
    const fileSize = stat.size;
    const ext = path.extname(absolutePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
    };
    const contentType = mimeTypes[ext] ?? "application/octet-stream";

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": contentType,
      });
      fs.createReadStream(absolutePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      });
      fs.createReadStream(absolutePath).pipe(res);
    }
  });

  expressApp.all("/mcp", async (req: Request, res: Response) => {
    // Create fresh server and transport for each request (stateless mode)
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Clean up when response ends
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();

  const httpServer = expressApp.listen(port, (err?: Error) => {
    if (err) return reject(err);
    console.log(`Server listening on http://localhost:${port}/mcp`);
    resolve();
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return promise;
}