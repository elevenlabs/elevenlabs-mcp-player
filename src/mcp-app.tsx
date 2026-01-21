/**
 * @file ElevenLabs Player - MCP App for playing audio files
 */
import type { App } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Loader2, PauseIcon, PlayIcon, Repeat, Repeat1 } from "lucide-react";

import {
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSpeedCycle,
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
  filePath: string; // For lazy loading
}

interface Track {
  id: string;
  src: string | null; // null until audio is loaded
  data: TrackData;
}

interface ServerTrackMetadata {
  id: string;
  filePath: string;
  title: string;
  artist?: string;
}

interface PlayAudioStructuredContent {
  tracks: ServerTrackMetadata[];
}

interface LoadAudioStructuredContent {
  dataUrl: string;
}

type RepeatMode = "none" | "playlist" | "track";

// Context for track loading functionality
interface TrackLoaderContextValue {
  loadAndPlayTrack: (track: Track) => Promise<void>;
  loadingTrackId: string | null;
}

const TrackLoaderContext = createContext<TrackLoaderContextValue | null>(null);

function useTrackLoader() {
  const ctx = useContext(TrackLoaderContext);
  if (!ctx) {
    throw new Error("useTrackLoader must be used within TrackLoaderProvider");
  }
  return ctx;
}

function parseTracksFromResult(callToolResult: CallToolResult): Track[] {
  // Prefer structuredContent (v0.4.0+) for type-safe access
  const structured = callToolResult.structuredContent as PlayAudioStructuredContent | undefined;
  if (structured?.tracks) {
    return structured.tracks.map((t) => ({
      id: t.id,
      src: null, // Audio not loaded yet - will be lazy loaded on play
      data: { title: t.title, artist: t.artist, filePath: t.filePath },
    }));
  }

  // Fallback to parsing text content (backwards compatibility)
  const textContent = callToolResult.content?.find((c) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      const serverTracks: ServerTrackMetadata[] = JSON.parse(textContent.text);
      return serverTracks.map((t) => ({
        id: t.id,
        src: null,
        data: { title: t.title, artist: t.artist, filePath: t.filePath },
      }));
    } catch {
      // Not JSON - likely a summary text, ignore
    }
  }
  return [];
}

function ElevenLabsPlayerApp() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { app, error } = useApp({
    appInfo: IMPLEMENTATION,
    capabilities: {},
    onAppCreated: (app: App) => {
      log.info("App created successfully");

      app.onteardown = async () => {
        log.info("App is being torn down");
        return {};
      };

      app.ontoolresult = async (result: CallToolResult) => {
        log.info("Tool result received:", result);
        setIsLoading(false);
        const newTracks = parseTracksFromResult(result);
        log.info("Parsed tracks:", newTracks);
        if (newTracks.length > 0) {
          setTracks((prev) => {
            // Deduplicate by track ID
            const existingIds = new Set(prev.map((t) => t.id));
            const uniqueNewTracks = newTracks.filter((t) => !existingIds.has(t.id));
            log.info("Adding tracks:", uniqueNewTracks.length);
            return [...prev, ...uniqueNewTracks];
          });
        }
      };

      app.onerror = (err: Error | null) => {
        // Ignore "unknown message ID" errors - these are timing issues during initialization
        if (err?.message?.includes("unknown message ID")) {
          log.warn("Ignoring initialization timing error:", err.message);
          return;
        }
        log.error("App error:", err);
        setIsLoading(false);
      };
    },
  });

  log.info("App state:", { app: !!app, error: error?.message, isLoading });

  // Ignore "unknown message ID" errors - these are timing issues during initialization
  const isIgnorableError = error?.message?.includes("unknown message ID");
  if (error && !isIgnorableError) {
    return <div className="text-red-500 p-4"><strong>ERROR:</strong> {error.message}</div>;
  }
  if (!app || isLoading) return <div className="text-gray-500 p-4 italic">Loading audio...</div>;

  return <ElevenLabsPlayerAppInner app={app} tracks={tracks} setTracks={setTracks} />;
}

interface ElevenLabsPlayerAppInnerProps {
  app: App;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
}

function TrackListItem({ track, trackNumber }: { track: Track; trackNumber: number }) {
  const player = useAudioPlayer<TrackData>();
  const { loadAndPlayTrack, loadingTrackId } = useTrackLoader();
  const isActive = player.isItemActive(track.id);
  const isCurrentlyPlaying = isActive && player.isPlaying;
  const isLoading = loadingTrackId === track.id;

  const handleClick = async () => {
    if (isLoading) return;
    if (isCurrentlyPlaying) {
      player.pause();
    } else {
      await loadAndPlayTrack(track);
    }
  };

  return (
    <div className="group/song relative">
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className={cn(
          "h-10 w-full justify-start px-3 font-normal",
          isActive && "bg-secondary"
        )}
        onClick={handleClick}
        disabled={isLoading}
      >
        <div className="flex w-full items-center gap-3">
          <div className="flex w-5 shrink-0 items-center justify-center">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCurrentlyPlaying ? (
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
  tracks: Track[];
  repeatMode: RepeatMode;
  onRepeatToggle: () => void;
}

function Player({ tracks, repeatMode, onRepeatToggle }: PlayerProps) {
  const player = useAudioPlayer<TrackData>();
  const { loadAndPlayTrack, loadingTrackId } = useTrackLoader();

  // Get the current track (from active item or first track)
  const currentTrack = tracks.find((t) => t.id === player.activeItem?.id) ?? tracks[0];
  const isLoading = loadingTrackId === currentTrack?.id;

  const handlePlayPause = async () => {
    if (isLoading) return;

    if (player.isPlaying) {
      player.pause();
    } else if (currentTrack) {
      // If track isn't loaded yet, load it first
      if (!currentTrack.src) {
        await loadAndPlayTrack(currentTrack);
      } else {
        player.play({ id: currentTrack.id, src: currentTrack.src, data: currentTrack.data });
      }
    }
  };

  return (
    <div className="flex flex-1 items-center p-4">
      <div className="w-full">
        <div className="mb-3">
          <h3 className="text-sm font-medium truncate">
            {currentTrack?.data?.title ?? "No track selected"}
          </h3>
          {currentTrack?.data?.artist && (
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack.data.artist}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="default"
            className="h-10 w-10 shrink-0"
            disabled={!currentTrack || isLoading}
            onClick={handlePlayPause}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : player.isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <AudioPlayerTime className="text-xs tabular-nums" />
            <AudioPlayerProgress className="flex-1" />
            <AudioPlayerDuration className="text-xs tabular-nums" />
            <AudioPlayerSpeedCycle />
            <RepeatButton mode={repeatMode} onToggle={onRepeatToggle} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface AudioPlayerContentProps {
  app: App;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
}

function AudioPlayerContent({ app, tracks, setTracks }: AudioPlayerContentProps) {
  const player = useAudioPlayer<TrackData>();
  const initializedRef = useRef(false);
  const prevTracksLengthRef = useRef(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "none") return "playlist";
      if (prev === "playlist") return "track";
      return "none";
    });
  };

  // Load audio for a track and play it
  const loadAndPlayTrack = useCallback(async (track: Track) => {
    // If already loaded, just play
    if (track.src) {
      player.play({ id: track.id, src: track.src, data: track.data });
      return;
    }

    // Load the audio via server tool
    setLoadingTrackId(track.id);
    try {
      log.info("Loading audio for track:", track.id, track.data.filePath);
      const result = await app.callServerTool({
        name: "load_audio",
        arguments: { filePath: track.data.filePath },
      });

      const structured = result.structuredContent as LoadAudioStructuredContent | undefined;
      if (result.isError || !structured?.dataUrl) {
        log.error("Failed to load audio:", result);
        return;
      }

      // Update the track with the loaded audio
      const loadedSrc = structured.dataUrl;
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, src: loadedSrc } : t))
      );

      // Play the track with the loaded audio
      player.play({ id: track.id, src: loadedSrc, data: track.data });
    } catch (err) {
      log.error("Error loading audio:", err);
    } finally {
      setLoadingTrackId(null);
    }
  }, [app, player, setTracks]);

  // Auto-select first track when tracks are first added (but don't load audio yet)
  useEffect(() => {
    if (tracks.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      // Just select, don't play - user must click to start
      const firstTrack = tracks[0];
      if (firstTrack.src) {
        player.setActiveItem({ id: firstTrack.id, src: firstTrack.src, data: firstTrack.data });
      }
    }
  }, [tracks, player]);

  // When new tracks are added, select the first new one if nothing is playing
  useEffect(() => {
    if (tracks.length > prevTracksLengthRef.current && !player.activeItem) {
      const newTrack = tracks[prevTracksLengthRef.current];
      if (newTrack.src) {
        player.setActiveItem({ id: newTrack.id, src: newTrack.src, data: newTrack.data });
      }
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
        // Play next track (will load if needed)
        loadAndPlayTrack(tracks[currentIndex + 1]);
      } else if (repeatMode === "playlist" && tracks.length > 0) {
        // Loop back to first track
        loadAndPlayTrack(tracks[0]);
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [tracks, player, repeatMode, loadAndPlayTrack]);

  if (tracks.length === 0) {
    return (
      <div className="p-6 text-gray-500 text-center italic">
        No audio loaded. Use the play_audio tool to add tracks.
      </div>
    );
  }

  const trackLoaderValue: TrackLoaderContextValue = { loadAndPlayTrack, loadingTrackId };

  return (
    <TrackLoaderContext.Provider value={trackLoaderValue}>
      <div className="flex flex-col overflow-hidden bg-background">
        <Player tracks={tracks} repeatMode={repeatMode} onRepeatToggle={cycleRepeatMode} />
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
    </TrackLoaderContext.Provider>
  );
}

function ElevenLabsPlayerAppInner({ app, tracks, setTracks }: ElevenLabsPlayerAppInnerProps) {
  return (
    <main className="w-full">
      <AudioPlayerProvider>
        <AudioPlayerContent app={app} tracks={tracks} setTracks={setTracks} />
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
    <ElevenLabsPlayerApp />
  </StrictMode>,
);
