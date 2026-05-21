"use client";

import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { MemoryCategory } from "@/lib/memory-types";

interface HandTrackerProps {
  onRegion: (region: MemoryCategory | null) => void;
}

type Status = "loading" | "ready" | "error";

export function HandTracker({ onRegion }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRegionRef = useRef<MemoryCategory | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    async function init() {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
        );
        const landmarker = await HandLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
          },
        );
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        setStatus("ready");

        const tick = () => {
          if (cancelled) return;
          const landmarker = landmarkerRef.current;
          const video = videoRef.current;
          if (landmarker && video && video.readyState >= 2) {
            const result: HandLandmarkerResult = landmarker.detectForVideo(
              video,
              performance.now(),
            );

            if (result.landmarks.length > 0 && result.landmarks[0]) {
              const tip = result.landmarks[0][8];
              if (tip) {
                // Mirror X because front cameras are mirrored
                const x = (1 - tip.x) * window.innerWidth;
                const y = tip.y * window.innerHeight;
                const cursor = cursorRef.current;
                if (cursor) {
                  cursor.style.transform = `translate(${x - 18}px, ${y - 18}px)`;
                  cursor.style.opacity = "1";
                }

                const el = document.elementFromPoint(x, y) as HTMLElement | null;
                const region = (el?.dataset.region ?? null) as
                  | MemoryCategory
                  | null;
                if (region !== lastRegionRef.current) {
                  lastRegionRef.current = region;
                  onRegion(region);
                }
              }
            } else {
              if (cursorRef.current) cursorRef.current.style.opacity = "0";
              if (lastRegionRef.current !== null) {
                lastRegionRef.current = null;
                onRegion(null);
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : String(e));
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, [onRegion]);

  return (
    <>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute right-4 top-4 z-40 h-24 w-32 rounded border border-amber-core/30 opacity-60"
        style={{ transform: "scaleX(-1)" }}
      />
      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-0 top-0 z-50 h-9 w-9 rounded-full bg-amber-core/40 transition-opacity duration-100"
        style={{
          opacity: 0,
          boxShadow: "0 0 28px 8px rgba(255, 169, 64, 0.5)",
        }}
      />
      {status === "loading" && (
        <div className="absolute right-4 top-32 z-40 rounded bg-charcoal-800/80 px-2 py-1 text-xs text-amber-glow">
          Loading hand tracker…
        </div>
      )}
      {status === "error" && (
        <div className="absolute right-4 top-32 z-40 max-w-xs rounded bg-red-900/80 px-2 py-1 text-xs text-red-100">
          Camera error: {errorMsg}
        </div>
      )}
    </>
  );
}
