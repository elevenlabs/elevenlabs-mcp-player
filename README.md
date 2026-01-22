![export](https://github.com/user-attachments/assets/ee379feb-348d-48e7-899c-134f7f7cd74f)

<div class="title-block" style="text-align: center;" align="center">

  [![Discord Community](https://img.shields.io/badge/discord-@elevenlabs-000000.svg?style=for-the-badge&logo=discord&labelColor=000)](https://discord.gg/elevenlabs)
  [![Twitter](https://img.shields.io/badge/Twitter-@elevenlabsio-000000.svg?style=for-the-badge&logo=twitter&labelColor=000)](https://x.com/ElevenLabsDevs)

</div>

<p align="center">
  Audio Player <a href="https://github.com/modelcontextprotocol/mcpb">MCP Bundle</a> for Claude Desktop that plays any audio file with a built-in player UI.
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/3ab700ed-5e1c-4e21-b969-56696c3b52dd" />
</p>

## What it does

- Exposes a `play_audio` tool that accepts one or more audio tracks
- Renders an audio player UI with playback controls, progress bar, and speed adjustment
- Supports queueing multiple tracks with a playlist view
- Loads audio files on-demand for efficient playback

## Installation

### Build the MCPB Bundle

```bash
# Clone the repository
git clone https://github.com/elevenlabs/elevenlabs-mcp-player.git
cd elevenlabs-mcp-player

# Install dependencies
npm install

# Build and pack the bundle
npm run pack
```

This creates `elevenlabs-player.mcpb` in the project root.

### Install in Claude Desktop

Open the bundle with Claude Desktop:

```bash
open elevenlabs-player.mcpb
```

Or double-click the `.mcpb` file in Finder.

## Usage

Once installed, ask Claude to play audio files:

> "Play the audio file at /Users/me/Music/song.mp3"

Or provide multiple tracks:

> "Play these audio files: /path/to/track1.mp3 and /path/to/track2.mp3"

### Tool Input

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

| Field | Required | Description |
|-------|----------|-------------|
| `filePath` | Yes | Absolute path to the audio file |
| `title` | Yes | Display title for the track |
| `artist` | No | Artist name |

### Supported Formats

- MP3 (`.mp3`)
- WAV (`.wav`)
- OGG (`.ogg`)
- M4A (`.m4a`)
- AAC (`.aac`)

## Development

### Requirements

- Node.js 20+
- npm

### Testing Locally

Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test the server without Claude Desktop:

```bash
# Install dependencies
npm install

# Build and run with MCP Inspector
npm run dev
```

This opens a browser UI at `http://localhost:6274` where you can:
- View available tools (`play_audio`, `load_audio`)
- Test tool calls with sample inputs
- Inspect responses and debug issues

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build and test with MCP Inspector |
| `npm run build` | Build UI and server |
| `npm run pack` | Create MCPB bundle |

### Project Structure

```
├── manifest.json          # MCPB bundle manifest
├── server.ts              # MCP server with tool registration
├── src/
│   ├── mcp-app.tsx        # React audio player UI
│   └── components/ui/     # UI components
├── dist/
│   ├── server.js          # Compiled server
│   └── mcp-app.html       # Bundled UI
└── .mcpbignore            # Files to exclude from bundle
```

## Privacy

This extension runs entirely locally on your machine. Audio files are read from your local filesystem and are not transmitted to any external servers. No data is collected or shared.

For more information about ElevenLabs' data practices, see the [ElevenLabs Privacy Policy](https://elevenlabs.io/privacy-policy).

## License

MIT License - see [LICENSE](LICENSE) for details.
