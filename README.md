# ElevenLabs MCP Player

An MCP (Model Context Protocol) app that provides an audio player UI for playing local audio files. Designed to run within Claude Desktop or other MCP-compatible hosts.

## What it does

- Exposes a `play_audio` tool that accepts one or more audio tracks
- Renders an audio player UI with playback controls, progress bar, and speed adjustment
- Supports queueing multiple tracks with a playlist view
- Streams local audio files through an HTTP endpoint

## Tool Input

The `play_audio` tool accepts an array of tracks:

```json
{
  "tracks": [
    {
      "file_path": "/absolute/path/to/audio.mp3",
      "title": "Track Title",
      "artist": "Artist Name"
    }
  ]
}
```

- `file_path` (required): Absolute path to the audio file
- `title` (required): Display title
- `artist` (optional): Artist name

## Requirements

- Bun

## Running Locally

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

This runs both the Vite build watcher and the MCP server on `http://localhost:3001/mcp`.

## Building

Build for production:

```bash
bun run build
```

## Project Structure

- `server.ts` - MCP server with tool and resource registration
- `src/mcp-app.tsx` - React app with audio player UI
- `src/server-utils.ts` - HTTP server utilities including audio file streaming
- `src/components/ui/audio-player.tsx` - Audio player components
