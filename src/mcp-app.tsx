/**
 * @file ElevenLabs Player - MCP App for playing audio files
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { PauseIcon, PlayIcon, Repeat, Repeat1 } from "lucide-react";

import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSpeed,
  AudioPlayerTime,
  useAudioPlayer,
} from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const IMPLEMENTATION = { name: "ElevenLabs Player", version: "1.0.0" };

const log = {
  info: console.log.bind(console, "[ElevenLabs Player]"),
  warn: console.warn.bind(console, "[ElevenLabs Player]"),
  error: console.error.bind(console, "[ElevenLabs Player]"),
};

interface TrackData {
  title: string;
  artist?: string;
}

interface Track {
  id: string;
  src: string;
  data: TrackData;
}

interface ServerTrack {
  id: string;
  filePath: string;
  title: string;
  artist?: string;
}

type RepeatMode = "none" | "playlist" | "track";

function parseTracksFromResult(callToolResult: CallToolResult): Track[] {
  const textContent = callToolResult.content?.find((c) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      const serverTracks: ServerTrack[] = JSON.parse(textContent.text);
      return serverTracks.map((t) => ({
        id: t.id,
        src: `http://localhost:3001/audio?path=${encodeURIComponent(t.filePath)}`,
        data: { title: t.title, artist: t.artist },
      }));
    } catch {
      log.error("Failed to parse tracks from result");
    }
  }
  return [];
}

function ElevenLabsPlayerApp() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const { app, error } = useApp({
    appInfo: IMPLEMENTATION,
    capabilities: {},
    onAppCreated: (app: App) => {
      app.onteardown = async () => {
        log.info("App is being torn down");
        return {};
      };

      app.ontoolresult = async (result: CallToolResult) => {
        const newTracks = parseTracksFromResult(result);
        if (newTracks.length > 0) {
          setTracks((prev) => {
            // Deduplicate by track ID
            const existingIds = new Set(prev.map((t) => t.id));
            const uniqueNewTracks = newTracks.filter((t) => !existingIds.has(t.id));
            return [...prev, ...uniqueNewTracks];
          });
        }
      };

      app.onerror = log.error;
    },
  });

  if (error) return <div className="text-red-500 p-4"><strong>ERROR:</strong> {error.message}</div>;
  if (!app) return <div className="text-gray-500 p-4">Connecting...</div>;

  return <ElevenLabsPlayerAppInner tracks={tracks} />;
}

interface ElevenLabsPlayerAppInnerProps {
  tracks: Track[];
}

function TrackListItem({ track, trackNumber }: { track: Track; trackNumber: number }) {
  const player = useAudioPlayer<TrackData>();
  const isActive = player.isItemActive(track.id);
  const isCurrentlyPlaying = isActive && player.isPlaying;

  return (
    <div className="group/song relative">
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-10 w-full justify-start px-3 font-normal",
          isActive && "bg-secondary"
        )}
        onClick={() => {
          if (isCurrentlyPlaying) {
            player.pause();
          } else {
            player.play({ id: track.id, src: track.src, data: track.data });
          }
        }}
      >
        <div className="flex w-full items-center gap-3">
          <div className="flex w-5 shrink-0 items-center justify-center">
            {isCurrentlyPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <>
                <span className="text-muted-foreground/60 text-sm tabular-nums group-hover/song:invisible">
                  {trackNumber}
                </span>
                <PlayIcon className="invisible absolute h-4 w-4 group-hover/song:visible" />
              </>
            )}
          </div>
          <div className="flex flex-col items-start truncate">
            <span className="truncate text-left text-sm">{track.data.title}</span>
            {track.data.artist && (
              <span className="text-muted-foreground text-xs truncate">{track.data.artist}</span>
            )}
          </div>
        </div>
      </Button>
    </div>
  );
}

interface RepeatButtonProps {
  mode: RepeatMode;
  onToggle: () => void;
}

function RepeatButton({ mode, onToggle }: RepeatButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className={cn(
        "h-8 w-8",
        mode === "none" && "text-muted-foreground/50 hover:text-muted-foreground",
        mode !== "none" && "text-primary bg-primary/10 hover:bg-primary/20"
      )}
      title={
        mode === "none"
          ? "Repeat off"
          : mode === "playlist"
          ? "Repeat playlist"
          : "Repeat track"
      }
    >
      {mode === "track" ? (
        <Repeat1 className="h-4 w-4" />
      ) : (
        <Repeat className="h-4 w-4" />
      )}
    </Button>
  );
}

interface PlayerProps {
  repeatMode: RepeatMode;
  onRepeatToggle: () => void;
}

function Player({ repeatMode, onRepeatToggle }: PlayerProps) {
  const player = useAudioPlayer<TrackData>();

  return (
    <div className="flex flex-1 items-center p-4">
      <div className="w-full">
        <div className="mb-3">
          <h3 className="text-sm font-medium truncate">
            {player.activeItem?.data?.title ?? "No track selected"}
          </h3>
          {player.activeItem?.data?.artist && (
            <p className="text-xs text-muted-foreground truncate">
              {player.activeItem.data.artist}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AudioPlayerButton
            variant="outline"
            size="default"
            className="h-10 w-10 shrink-0"
            disabled={!player.activeItem}
          />
          <div className="flex flex-1 items-center gap-2">
            <AudioPlayerTime className="text-xs tabular-nums" />
            <AudioPlayerProgress className="flex-1" />
            <AudioPlayerDuration className="text-xs tabular-nums" />
            <AudioPlayerSpeed variant="ghost" size="icon" />
            <RepeatButton mode={repeatMode} onToggle={onRepeatToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioPlayerContent({ tracks }: { tracks: Track[] }) {
  const player = useAudioPlayer<TrackData>();
  const initializedRef = useRef(false);
  const prevTracksLengthRef = useRef(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "none") return "playlist";
      if (prev === "playlist") return "track";
      return "none";
    });
  };

  // Auto-select first track when tracks are first added
  useEffect(() => {
    if (tracks.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      player.setActiveItem(tracks[0]);
    }
  }, [tracks, player]);

  // When new tracks are added, select the first new one if nothing is playing
  useEffect(() => {
    if (tracks.length > prevTracksLengthRef.current && !player.activeItem) {
      player.setActiveItem(tracks[prevTracksLengthRef.current]);
    }
    prevTracksLengthRef.current = tracks.length;
  }, [tracks, player]);

  // Set audio loop property based on repeat mode
  useEffect(() => {
    const audio = player.ref.current;
    if (audio) {
      audio.loop = repeatMode === "track";
    }
  }, [repeatMode, player.ref]);

  // Auto-advance to next track when current one ends
  useEffect(() => {
    const audio = player.ref.current;
    if (!audio) return;

    const handleEnded = () => {
      // If repeat track is on, the audio element handles looping via loop property
      if (repeatMode === "track") return;

      const currentIndex = tracks.findIndex((t) => t.id === player.activeItem?.id);
      if (currentIndex >= 0 && currentIndex < tracks.length - 1) {
        // Play next track
        player.play(tracks[currentIndex + 1]);
      } else if (repeatMode === "playlist" && tracks.length > 0) {
        // Loop back to first track
        player.play(tracks[0]);
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [tracks, player, repeatMode]);

  if (tracks.length === 0) {
    return (
      <div className="p-6 text-gray-500 text-center italic">
        No audio loaded. Use the play_audio tool to add tracks.
      </div>
    );
  }

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden bg-background">
      <Player repeatMode={repeatMode} onRepeatToggle={cycleRepeatMode} />
      {tracks.length > 1 && (
        <div className="bg-muted/50 border-t">
          <div className="max-h-48 overflow-y-auto">
            <div className="space-y-1 p-2">
              {tracks.map((track, index) => (
                <TrackListItem key={track.id} track={track} trackNumber={index + 1} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ElevenLabsPlayerAppInner({ tracks }: ElevenLabsPlayerAppInnerProps) {
  return (
    <main className="w-full max-w-md p-4">
      <AudioPlayerProvider>
        <AudioPlayerContent tracks={tracks} />
      </AudioPlayerProvider>
    </main>
  );
}

// Detect and sync dark mode from system preference
function applyColorScheme() {
  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", isDark);
}

applyColorScheme();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyColorScheme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="flex justify-center">
      <ElevenLabsPlayerApp />
    </div>
  </StrictMode>,
);
