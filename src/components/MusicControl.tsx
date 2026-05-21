import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MUSIC_PLAYLIST = [
  "/audio/experience.mpeg",
  "/audio/icarus.mpeg",
  "/audio/marriage-of-figaro.mpeg",
];

export function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackIndexRef = useRef(0);
  const enabledRef = useRef(true);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_PLAYLIST[0]);
    audio.loop = false;
    audio.volume = 0.42;
    audioRef.current = audio;

    function playNextTrack() {
      trackIndexRef.current = (trackIndexRef.current + 1) % MUSIC_PLAYLIST.length;
      audio.src = MUSIC_PLAYLIST[trackIndexRef.current];

      if (enabledRef.current) {
        void playAudio(audio);
      }
    }

    audio.addEventListener("ended", playNextTrack);

    if (enabled) {
      void playAudio(audio);
    }

    function resumeAfterGesture() {
      if (enabledRef.current && audio.paused) {
        void playAudio(audio);
      }
    }

    window.addEventListener("pointerdown", resumeAfterGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", resumeAfterGesture);
      audio.removeEventListener("ended", playNextTrack);
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
      enabledRef.current = false;
      setEnabled(false);
      setBlocked(false);
      return;
    }

    enabledRef.current = true;
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
