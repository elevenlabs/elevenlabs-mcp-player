![export](https://github.com/user-attachments/assets/ee379feb-348d-48e7-899c-134f7f7cd74f)

<div class="title-block" style="text-align: center;" align="center">

  [![Discord Community](https://img.shields.io/badge/discord-@elevenlabs-000000.svg?style=for-the-badge&logo=discord&labelColor=000)](https://discord.gg/elevenlabs)
  [![Twitter](https://img.shields.io/badge/Twitter-@elevenlabsio-000000.svg?style=for-the-badge&logo=twitter&labelColor=000)](https://x.com/ElevenLabsDevs)

</div>

<p align="center">
  Audio Player <a href="https://github.com/modelcontextprotocol/mcpb">MCP Bundle</a> for Claude Desktop with ElevenLabs integration. Generate speech, sound effects, and music, or play any local audio file.
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/3ab700ed-5e1c-4e21-b969-56696c3b52dd" />
</p>

## Features

- **Text-to-Speech** - Generate speech from text using ElevenLabs voices
- **Sound Effects** - Create sound effects from text descriptions
- **Music Generation** - Compose music from prompts
- **Audio Playback** - Play any local audio file with a built-in player UI
- **Playlist Support** - Queue multiple tracks with playlist view
- **Playback Controls** - Progress bar, speed adjustment, and standard controls

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

## Configuration

To use the ElevenLabs generation features (TTS, sound effects, music), configure your API key in Claude Desktop:

1. Open Claude Desktop settings
2. Navigate to the ElevenLabs Player extension settings
3. Enter your `ELEVENLABS_API_KEY`

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key (required for generation) | - |
| `ELEVENLABS_OUTPUT_DIR` | Directory to save generated audio | Desktop |

## Usage

### Generate Speech

> "Say 'Hello, world!' using ElevenLabs"

> "Generate speech for this text: Welcome to the future of AI"

### Generate Sound Effects

> "Create a sound effect of thunder and rain"

> "Generate the sound of a spaceship taking off"

### Generate Music

> "Compose a calm piano melody for relaxation"

> "Generate upbeat electronic music for a workout"

### Play Local Audio

> "Play the audio file at /Users/me/Music/song.mp3"

> "Play these audio files: /path/to/track1.mp3 and /path/to/track2.mp3"

## Tools

### `generate_tts`

Generates speech from text using ElevenLabs text-to-speech.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `text` | Yes | The text to convert to speech |
| `voice_id` | No | ElevenLabs voice ID (default: Juniper) |
| `model_id` | No | Model ID (default: eleven_v3) |
| `title` | No | Display title for the track |

### `generate_sound_effect`

Generates a sound effect from a text description.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `prompt` | Yes | Description of the sound effect |
| `duration_seconds` | No | Duration in seconds |
| `title` | No | Display title for the track |

### `generate_music`

Generates music from a text prompt.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `prompt` | Yes | Description of the music (genre, mood, instruments) |
| `duration_seconds` | No | Duration in seconds |
| `instrumental` | No | Force instrumental only (no vocals) |
| `title` | No | Display title for the track |

### `play_audio`

Plays one or more local audio files.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `tracks` | Yes | Array of track objects |
| `tracks[].filePath` | Yes | Absolute path to the audio file |
| `tracks[].title` | Yes | Display title |
| `tracks[].artist` | No | Artist name |

### Supported Audio Formats

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
- View available tools
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

This extension runs locally on your machine. Local audio files are read from your filesystem and are not transmitted externally.

When using ElevenLabs generation features (TTS, sound effects, music), your text prompts are sent to the ElevenLabs API. Generated audio is saved locally to your configured output directory.

For more information about ElevenLabs' data practices, see the [ElevenLabs Privacy Policy](https://elevenlabs.io/privacy-policy).

## License

MIT License - see [LICENSE](LICENSE) for details.
