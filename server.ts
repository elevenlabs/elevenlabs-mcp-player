import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
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

async function readAudioAsDataUrl(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "audio/mpeg";
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

// Schema for track input (from agent)
const trackInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the audio file"),
  title: z.string().describe("Display title for the track"),
  artist: z.string().optional().describe("Optional artist name"),
});

// Schema for track metadata output (no audio data - lazy loaded)
const trackMetadataSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  title: z.string(),
  artist: z.string().optional(),
});

const playAudioOutputSchema = z.object({
  tracks: z.array(trackMetadataSchema),
});

// Schema for load_audio tool (lazy loading)
const loadAudioInputSchema = z.object({
  filePath: z.string().describe("Absolute path to the audio file to load"),
});

const loadAudioOutputSchema = z.object({
  dataUrl: z.string().describe("Base64 data URL of the audio file"),
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
    tracks: z.array(trackInputSchema).describe("Array of tracks to add to the queue"),
  });

  // Register the play_audio tool - returns metadata only, audio is lazy loaded
  registerAppTool(server,
    "play_audio",
    {
      title: "Play Audio",
      description: "Adds one or more audio tracks to the ElevenLabs Player queue. Each track requires a filePath and title. Audio data is loaded on-demand when playback starts.",
      inputSchema: playAudioInputSchema,
      outputSchema: playAudioOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: { ui: { resourceUri } },
    },
    async ({ tracks }: z.infer<typeof playAudioInputSchema>): Promise<CallToolResult> => {
      const validatedTracks = [];
      const batchId = Date.now();

      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const absolutePath = path.resolve(track.filePath);
        try {
          // Just verify the file exists, don't read it yet
          await fs.access(absolutePath);
          validatedTracks.push({
            id: `${batchId}-${i}`,
            filePath: absolutePath,
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

      const structuredContent = { tracks: validatedTracks };
      const textSummary = `Added ${validatedTracks.length} track(s) to queue`;

      return {
        content: [{ type: "text", text: textSummary }],
        structuredContent,
      };
    },
  );

  // Register the load_audio tool - lazy loads audio data for a single file
  registerAppTool(server,
    "load_audio",
    {
      title: "Load Audio",
      description: "Loads audio data for a single file. Called by the player UI when playback starts.",
      inputSchema: loadAudioInputSchema,
      outputSchema: loadAudioOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
      _meta: { ui: { resourceUri } },
    },
    async ({ filePath }: z.infer<typeof loadAudioInputSchema>): Promise<CallToolResult> => {
      const absolutePath = path.resolve(filePath);
      try {
        await fs.access(absolutePath);
        const dataUrl = await readAudioAsDataUrl(absolutePath);
        return {
          content: [{ type: "text", text: "Audio loaded" }],
          structuredContent: { dataUrl },
        };
      } catch {
        return {
          isError: true,
          content: [{ type: "text", text: `File not found: ${absolutePath}` }],
        };
      }
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
