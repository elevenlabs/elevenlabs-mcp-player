![export](https://github.com/user-attachments/assets/ee379feb-348d-48e7-899c-134f7f7cd74f)

<div class="title-block" style="text-align: center;" align="center">

  [![Discord Community](https://img.shields.io/badge/discord-@elevenlabs-000000.svg?style=for-the-badge&logo=discord&labelColor=000)](https://discord.gg/elevenlabs)
  [![Twitter](https://img.shields.io/badge/Twitter-@elevenlabsio-000000.svg?style=for-the-badge&logo=twitter&labelColor=000)](https://x.com/ElevenLabsDevs)

</div>


<p align="center">
  Audio Player <a href="https://github.com/modelcontextprotocol/ext-apps">Model Context Protocol (MCP) app</a> that plays any audio file from within your MCP client.
</p>

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
      "filePath": "/absolute/path/to/audio.mp3",
      "title": "Track Title",
      "artist": "Artist Name"
    }
  ]
}
```

- `filePath` (required): Absolute path to the audio file
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
