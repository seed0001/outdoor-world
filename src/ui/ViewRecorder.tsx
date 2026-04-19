import { useEffect, useRef, useState, type RefObject } from "react";

function pickRecorderMime(): string {
  const c = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const t of c) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

/**
 * Toggle recording of the WebGL canvas with **R**: first press starts, second
 * stops and downloads a `.webm` file.
 */
export default function ViewRecorder({
  canvasWrapRef,
}: {
  canvasWrapRef: RefObject<HTMLDivElement | null>;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyR" || e.repeat) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }

      const canvas = canvasWrapRef.current?.querySelector("canvas");
      if (!canvas) return;

      e.preventDefault();

      const existing = recorderRef.current;
      if (existing && existing.state === "recording") {
        existing.stop();
        return;
      }

      const mimeType = pickRecorderMime();
      chunksRef.current = [];

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(60);
      } catch {
        return;
      }

      try {
        const mr = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 8_000_000,
        });
        mr.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        mr.onstop = () => {
          setRecording(false);
          recorderRef.current = null;
          const blob = new Blob(chunksRef.current, { type: mimeType });
          chunksRef.current = [];
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `outdoor-world-view-${stamp}.webm`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          for (const tr of stream.getTracks()) tr.stop();
        };
        recorderRef.current = mr;
        mr.start(100);
        setRecording(true);
      } catch {
        for (const tr of stream.getTracks()) tr.stop();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canvasWrapRef]);

  if (!recording) return null;

  return (
    <div
      className="view-recorder-badge"
      role="status"
      aria-live="polite"
      aria-label="Recording view"
    >
      <span className="view-recorder-badge__dot" aria-hidden />
      <span className="view-recorder-badge__text">REC</span>
    </div>
  );
}
