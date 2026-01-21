#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.dirname.endsWith("dist")
  ? import.meta.dirname
  : path.join(import.meta.dirname, "dist");

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

// MCP App resource MIME type
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const RESOURCE_URI = "ui://elevenlabs-player/mcp-app.html";

async function readAudioAsDataUrl(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "audio/mpeg";
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

const server = new Server(
  {
    name: "ElevenLabs Player",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools with UI metadata
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "play_audio",
        description: "Adds one or more audio tracks to the ElevenLabs Player queue. Each track requires a filePath and title. Audio data is loaded on-demand when playback starts.",
        inputSchema: {
          type: "object",
          properties: {
            tracks: {
              type: "array",
              description: "Array of tracks to add to the queue",
              items: {
                type: "object",
                properties: {
                  filePath: { type: "string", description: "Absolute path to the audio file" },
                  title: { type: "string", description: "Display title for the track" },
                  artist: { type: "string", description: "Optional artist name" },
                },
                required: ["filePath", "title"],
              },
            },
          },
          required: ["tracks"],
        },
        // UI metadata - tells Claude to display the resource
        _meta: {
          ui: { resourceUri: RESOURCE_URI },
        },
      },
      {
        name: "load_audio",
        description: "Loads audio data for a single file. Called by the player UI when playback starts.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Absolute path to the audio file to load" },
          },
          required: ["filePath"],
        },
        _meta: {
          ui: { resourceUri: RESOURCE_URI },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "play_audio") {
    const { tracks } = args as { tracks: Array<{ filePath: string; title: string; artist?: string }> };
    const validatedTracks = [];
    const batchId = Date.now();

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const absolutePath = path.resolve(track.filePath);
      try {
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
          content: [{ type: "text" as const, text: `File not found: ${absolutePath}` }],
        };
      }
    }

    return {
      content: [{ type: "text" as const, text: `Added ${validatedTracks.length} track(s) to queue` }],
      structuredContent: { tracks: validatedTracks },
    };
  }

  if (name === "load_audio") {
    const { filePath } = args as { filePath: string };
    const absolutePath = path.resolve(filePath);
    try {
      await fs.access(absolutePath);
      const dataUrl = await readAudioAsDataUrl(absolutePath);
      return {
        content: [{ type: "text" as const, text: "Audio loaded" }],
        structuredContent: { dataUrl },
      };
    } catch {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `File not found: ${absolutePath}` }],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// List resources (the UI HTML)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: RESOURCE_URI,
        name: "ElevenLabs Player UI",
        mimeType: RESOURCE_MIME_TYPE,
      },
    ],
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === RESOURCE_URI) {
    const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
    return {
      contents: [
        { uri, mimeType: RESOURCE_MIME_TYPE, text: html },
      ],
    };
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[ElevenLabs Player] Server running");
