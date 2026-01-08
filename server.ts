import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps/server";
import { startServer } from "./src/server-utils.js";
import { z } from "zod";

const DIST_DIR = path.join(import.meta.dirname, "dist");

const trackSchema = z.object({
  file_path: z.string().describe("Absolute path to the audio file"),
  title: z.string().describe("Display title for the track"),
  artist: z.string().optional().describe("Optional artist name"),
});

/**
 * Creates a new MCP server instance with tools and resources registered.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: "ElevenLabs Player",
    version: "1.0.0",
  });

  const resourceUri = "ui://elevenlabs-player/mcp-app.html";

  const playAudioInputSchema = z.object({
    tracks: z.array(trackSchema).describe("Array of tracks to add to the queue"),
  });

  // Register the play_audio tool
  registerAppTool(server,
    "play_audio",
    {
      title: "Play Audio",
      description: "Adds one or more audio tracks to the ElevenLabs Player queue. Each track requires a file_path and title.",
      inputSchema: playAudioInputSchema,
      _meta: { [RESOURCE_URI_META_KEY]: resourceUri },
    },
    async ({ tracks }): Promise<CallToolResult> => {
      const validatedTracks = [];

      for (const track of tracks) {
        const absolutePath = path.resolve(track.file_path);
        try {
          await fs.access(absolutePath);
          validatedTracks.push({
            id: crypto.randomUUID(),
            file_path: absolutePath,
            title: track.title,
            artist: track.artist,
          });
        } catch {
          return {
            isError: true,
            content: [{ type: "text", text: `File not found: ${absolutePath}` }],
          };
        }
      }

      // Return the tracks as JSON for the app to parse
      return {
        content: [{ type: "text", text: JSON.stringify(validatedTracks) }]
      };
    },
  );

  // Register the resource, which returns the bundled HTML/JavaScript for the UI.
  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}

startServer(createServer);
