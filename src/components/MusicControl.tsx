import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MUSIC_SRC = "/audio/music.mp3";

export function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.42;
    audioRef.current = audio;

    if (enabled) {
      void playAudio(audio);
    }

    function resumeAfterGesture() {
      if (enabled && audio.paused) {
        void playAudio(audio);
      }
    }

    window.addEventListener("pointerdown", resumeAfterGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resumeAfterGesture);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  async function playAudio(audio = audioRef.current) {
    if (!audio) {
      return;
    }

    try {
      await audio.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }

  function toggleMusic() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (enabled) {
      audio.pause();
      setEnabled(false);
      setBlocked(false);
      return;
    }

    setEnabled(true);
    void playAudio(audio);
  }

  return (
    <button className="connection-item music-toggle" type="button" onClick={toggleMusic}>
      {enabled && !blocked ? <Volume2 size={18} /> : <VolumeX size={18} />}
      <div>
        <span>Music</span>
        <strong>{enabled ? "Turn off music" : "Turn on music"}</strong>
      </div>
    </button>
  );
}
