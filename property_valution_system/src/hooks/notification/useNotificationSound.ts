"use client";

import { useEffect, useRef, useState } from "react";

type Source = { src: string; type: string };

export function useNotificationSound(
  sources: Source[] = [
    { src: "/sounds/notification-sound.mp3", type: "audio/mpeg" },
  ],
  volume = 0.6
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    a.volume = volume;

    // pick first supported
    const chosen =
      sources.find((s) => a.canPlayType(s.type) !== "") ?? sources[0];

    if (chosen?.src) {
      a.src = chosen.src;
      a.load();
    }

    audioRef.current = a;

    return () => {
      audioRef.current = null;
    };
  }, [volume, JSON.stringify(sources)]);

  // must be called from user click
  const enable = async () => {
    try {
      const a = audioRef.current;
      if (!a) return false;

      // warm-up (unlock audio)
      a.currentTime = 0;
      await a.play();
      a.pause();
      a.currentTime = 0;

      setEnabled(true);
      return true;
    } catch {
      setEnabled(false);
      return false;
    }
  };

  const play = async () => {
    try {
      const a = audioRef.current;
      if (!a) return;
      a.currentTime = 0;
      await a.play();
    } catch {
      // ignore
    }
  };

  return { enabled, enable, play };
}
