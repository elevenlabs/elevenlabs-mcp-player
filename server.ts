import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE, RESOURCE_URI_META_KEY } from "@modelcontextprotocol/ext-apps/server";
import { startServer } from "./src/server-utils.js";
import { z } from "zod";

const DIST_DIR = path.join(import.meta.dirname, "dist");

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

const SIZE_WARNING_THRESHOLD = 5 * 1024 * 1024; // 5MB

interface AudioReadResult {
  dataUrl: string;
  sizeWarning?: string;
}

async function readAudioAsDataUrl(filePath: string): Promise<AudioReadResult> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "audio/mpeg";
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const sizeWarning = buffer.length > SIZE_WARNING_THRESHOLD
    ? `Warning: ${path.basename(filePath)} is ${(buffer.length / 1024 / 1024).toFixed(1)}MB - large files may load slowly`
    : undefined;

  return { dataUrl, sizeWarning };
}

const trackSchema = z.object({
  filePath: z.string().describe("Absolute path to the audio file"),
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
    async ({ tracks }: z.infer<typeof playAudioInputSchema>): Promise<CallToolResult> => {
      const validatedTracks = [];
      const warnings: string[] = [];
      const batchId = Date.now();

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const absolutePath = path.resolve(track.filePath);
        try {
          await fs.access(absolutePath);
          const { dataUrl, sizeWarning } = await readAudioAsDataUrl(absolutePath);
          if (sizeWarning) warnings.push(sizeWarning);
          validatedTracks.push({
            id: `${batchId}-${i}`,
            src: dataUrl,
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
      const content: CallToolResult["content"] = [
        { type: "text", text: JSON.stringify(validatedTracks) }
      ];

      // Add warnings as separate text content if any
      if (warnings.length > 0) {
        content.push({ type: "text", text: warnings.join("\n") });
      }

      return { content };
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
