#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

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

// Default voice and model settings
const DEFAULT_VOICE_ID = "aMSt68OGf4xUZAnLpTU8"; // Juniper
const DEFAULT_MODEL_ID = "eleven_v3";

// Lazy initialization of ElevenLabs client
let _client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!_client) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is required. Configure it in Claude Desktop settings.");
    }
    _client = new ElevenLabsClient({ apiKey });
  }
  return _client;
}

// Get output directory (defaults to Desktop)
function getOutputDir(): string {
  return process.env.ELEVENLABS_OUTPUT_DIR || path.join(os.homedir(), "Desktop");
}

// Generate a unique filename
function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${timestamp}${extension}`;
}

// Save audio stream to file
async function saveStreamToFile(stream: ReadableStream<Uint8Array>, filePath: string): Promise<void> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  await fs.writeFile(filePath, result);
}

async function readAudioAsDataUrl(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? "audio/mpeg";
  const buffer = await fs.readFile(filePath);
  const base64 = buffer.toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

const server = new McpServer({
  name: "ElevenLabs Player",
  version: "1.0.0",
});

// Register play_audio tool
server.registerTool(
  "play_audio",
  {
    title: "Play Audio",
    description: "Plays existing local audio files. Only use this for files that already exist on disk - do NOT use after generate_tts, generate_sound_effect, or generate_music (those already show the player).",
    inputSchema: {
      tracks: z.array(z.object({
        filePath: z.string().describe("Absolute path to the audio file"),
        title: z.string().describe("Display title for the track"),
        artist: z.string().optional().describe("Optional artist name"),
      })).describe("Array of tracks to add to the queue"),
    },
    annotations: {
      title: "Play Audio",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async ({ tracks }) => {
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
          isError: true as const,
          content: [{ type: "text" as const, text: `File not found: ${absolutePath}` }],
        };
      }
    }

    return {
      content: [{ type: "text" as const, text: `Added ${validatedTracks.length} track(s) to queue` }],
      structuredContent: { tracks: validatedTracks },
    };
  }
);

// Register load_audio tool
server.registerTool(
  "load_audio",
  {
    title: "Load Audio",
    description: "Loads audio data for a single file. Called by the player UI when playback starts.",
    inputSchema: {
      filePath: z.string().describe("Absolute path to the audio file to load"),
    },
    annotations: {
      title: "Load Audio",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async ({ filePath }) => {
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
        isError: true as const,
        content: [{ type: "text" as const, text: `File not found: ${absolutePath}` }],
      };
    }
  }
);

// Register generate_tts tool
server.registerTool(
  "generate_tts",
  {
    title: "Generate Speech",
    description: "Generates AND plays speech audio from text using ElevenLabs. This tool both generates and plays the audio - calling play_audio afterwards is redundant and will show a duplicate player. WARNING: This tool calls the ElevenLabs API and will incur costs on the user's account.",
    inputSchema: {
      text: z.string().describe("The text to convert to speech"),
      voice_id: z.string().optional().describe("ElevenLabs voice ID (default: Juniper)"),
      model_id: z.string().optional().describe("Model ID (default: eleven_v3)"),
      title: z.string().optional().describe("Display title for the track"),
    },
    annotations: {
      title: "Generate Speech",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async ({ text, voice_id, model_id, title }) => {
    try {
      const client = getClient();
      const response = await client.textToSpeech.convert(voice_id || DEFAULT_VOICE_ID, {
        text,
        modelId: model_id || DEFAULT_MODEL_ID,
      });

      const outputDir = getOutputDir();
      await fs.mkdir(outputDir, { recursive: true });
      const filename = generateFilename("tts", ".mp3");
      const filePath = path.join(outputDir, filename);

      await saveStreamToFile(response, filePath);

      const trackTitle = title || `Speech: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`;
      const batchId = Date.now();

      return {
        content: [{ type: "text" as const, text: `Generated speech saved to ${filePath}` }],
        structuredContent: {
          tracks: [{
            id: `${batchId}-0`,
            filePath,
            title: trackTitle,
            artist: "ElevenLabs TTS",
          }],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Failed to generate speech: ${message}` }],
      };
    }
  }
);

// Register generate_sound_effect tool
server.registerTool(
  "generate_sound_effect",
  {
    title: "Generate Sound Effect",
    description: "Generates AND plays a sound effect from a text prompt using ElevenLabs. This tool both generates and plays the audio - calling play_audio afterwards is redundant and will show a duplicate player. WARNING: This tool calls the ElevenLabs API and will incur costs on the user's account.",
    inputSchema: {
      prompt: z.string().describe("Description of the sound effect to generate"),
      duration_seconds: z.number().optional().describe("Duration in seconds (optional)"),
      title: z.string().optional().describe("Display title for the track"),
    },
    annotations: {
      title: "Generate Sound Effect",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async ({ prompt, duration_seconds, title }) => {
    try {
      const client = getClient();
      const response = await client.textToSoundEffects.convert({
        text: prompt,
        durationSeconds: duration_seconds,
      });

      const outputDir = getOutputDir();
      await fs.mkdir(outputDir, { recursive: true });
      const filename = generateFilename("sfx", ".mp3");
      const filePath = path.join(outputDir, filename);

      await saveStreamToFile(response, filePath);

      const trackTitle = title || `SFX: ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}`;
      const batchId = Date.now();

      return {
        content: [{ type: "text" as const, text: `Generated sound effect saved to ${filePath}` }],
        structuredContent: {
          tracks: [{
            id: `${batchId}-0`,
            filePath,
            title: trackTitle,
            artist: "ElevenLabs SFX",
          }],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Failed to generate sound effect: ${message}` }],
      };
    }
  }
);

// Register generate_music tool
server.registerTool(
  "generate_music",
  {
    title: "Generate Music",
    description: "Generates AND plays music from a text prompt using ElevenLabs. This tool both generates and plays the audio - calling play_audio afterwards is redundant and will show a duplicate player. WARNING: This tool calls the ElevenLabs API and will incur costs on the user's account.",
    inputSchema: {
      prompt: z.string().describe("Description of the music to generate (genre, mood, instruments, etc.)"),
      duration_seconds: z.number().optional().describe("Duration in seconds (default: model chooses based on prompt)"),
      instrumental: z.boolean().optional().describe("Force instrumental only (no vocals)"),
      title: z.string().optional().describe("Display title for the track"),
    },
    annotations: {
      title: "Generate Music",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    _meta: { ui: { resourceUri: RESOURCE_URI } },
  },
  async ({ prompt, duration_seconds, instrumental, title }) => {
    try {
      const client = getClient();
      const response = await client.music.compose({
        prompt,
        musicLengthMs: duration_seconds ? duration_seconds * 1000 : undefined,
        forceInstrumental: instrumental,
      });

      const outputDir = getOutputDir();
      await fs.mkdir(outputDir, { recursive: true });
      const filename = generateFilename("music", ".mp3");
      const filePath = path.join(outputDir, filename);

      await saveStreamToFile(response, filePath);

      const trackTitle = title || `Music: ${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}`;
      const batchId = Date.now();

      return {
        content: [{ type: "text" as const, text: `Generated music saved to ${filePath}` }],
        structuredContent: {
          tracks: [{
            id: `${batchId}-0`,
            filePath,
            title: trackTitle,
            artist: "ElevenLabs Music",
          }],
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        isError: true as const,
        content: [{ type: "text" as const, text: `Failed to generate music: ${message}` }],
      };
    }
  }
);

// Register UI resource
server.registerResource(
  "elevenlabs-player-ui",
  RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
    return {
      contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[ElevenLabs Player] Server running");
