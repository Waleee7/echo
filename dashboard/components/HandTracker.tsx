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

const PINCH_CONFIRM_PX = 36;
const PINCH_PREP_PX = 70;        // when fingers approach, latch cursor here
const CURSOR_LERP = 0.4;
const CLICK_COOLDOWN_MS = 500;
const DWELL_MS = 750;             // hover this long over a memory to select
const CURSOR_EVENT_THROTTLE_MS = 50; // 20Hz raycast for hover detection

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function HandTracker({ onRegion }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cursorWrapRef = useRef<HTMLDivElement | null>(null);
  const cursorDotRef = useRef<HTMLDivElement | null>(null);
  const dwellRingRef = useRef<SVGCircleElement | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRegionRef = useRef<MemoryCategory | null>(null);
  const smoothPosRef = useRef<{ x: number; y: number; initialized: boolean }>({
    x: 0,
    y: 0,
    initialized: false,
  });
  // Cursor position latched at the moment the pinch starts forming.
  // Using this for the click prevents the rightward drift that happens
  // as the index finger curls in during pinch closure.
  const latchedPosRef = useRef<{ x: number; y: number } | null>(null);
  const wasPinchingRef = useRef(false);
  const lastClickAtRef = useRef(0);
  const lastCursorDispatchRef = useRef(0);
  // Dwell tracking — hover same memory dot for DWELL_MS → synthetic select.
  const hoveredMemoryRef = useRef<string | null>(null);
  const dwellStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const onHover = (e: Event) => {
      const detail = (e as CustomEvent<{ memoryId: string | null }>).detail;
      const id = detail?.memoryId ?? null;
      if (id !== hoveredMemoryRef.current) {
        hoveredMemoryRef.current = id;
        dwellStartedAtRef.current = id ? performance.now() : null;
      }
    };
    window.addEventListener("echo-hover", onHover as EventListener);
    return () =>
      window.removeEventListener("echo-hover", onHover as EventListener);
  }, []);

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
          const wrap = cursorWrapRef.current;
          const cursor = cursorDotRef.current;
          const ring = dwellRingRef.current;

          if (landmarker && video && video.readyState >= 2) {
            const result: HandLandmarkerResult = landmarker.detectForVideo(
              video,
              performance.now(),
            );

            if (
              result.landmarks.length > 0 &&
              result.landmarks[0] &&
              result.landmarks[0][8] &&
              result.landmarks[0][4]
            ) {
              const indexTip = result.landmarks[0][8];
              const thumbTip = result.landmarks[0][4];

              // Mirror X because front-camera video is mirrored
              const targetX = (1 - indexTip.x) * window.innerWidth;
              const targetY = indexTip.y * window.innerHeight;

              // Smooth cursor position with lerp
              if (!smoothPosRef.current.initialized) {
                smoothPosRef.current.x = targetX;
                smoothPosRef.current.y = targetY;
                smoothPosRef.current.initialized = true;
              } else {
                smoothPosRef.current.x = lerp(
                  smoothPosRef.current.x,
                  targetX,
                  CURSOR_LERP,
                );
                smoothPosRef.current.y = lerp(
                  smoothPosRef.current.y,
                  targetY,
                  CURSOR_LERP,
                );
              }
              const cursorX = smoothPosRef.current.x;
              const cursorY = smoothPosRef.current.y;

              // Pinch distance — thumb tip to index tip
              const thumbX = (1 - thumbTip.x) * window.innerWidth;
              const thumbY = thumbTip.y * window.innerHeight;
              const pinchDist = Math.hypot(
                thumbX - cursorX,
                thumbY - cursorY,
              );
              const isPinching = pinchDist < PINCH_CONFIRM_PX;
              const isPreparingPinch = pinchDist < PINCH_PREP_PX;

              // Latch the cursor pos the first frame we cross the prep
              // threshold; that pos is what we click on if pinch confirms.
              if (isPreparingPinch && !latchedPosRef.current) {
                latchedPosRef.current = { x: cursorX, y: cursorY };
              } else if (!isPreparingPinch) {
                latchedPosRef.current = null;
              }

              const now = performance.now();

              // Dispatch cursor frame (throttled) so the canvas can raycast
              // to detect memory-dot hover and fire echo-hover back to us.
              if (
                now - lastCursorDispatchRef.current >
                CURSOR_EVENT_THROTTLE_MS
              ) {
                lastCursorDispatchRef.current = now;
                window.dispatchEvent(
                  new CustomEvent("echo-cursor", {
                    detail: { x: cursorX, y: cursorY },
                  }),
                );
              }

              // Dwell selection — same memory hovered for DWELL_MS
              let dwellProgress = 0;
              if (hoveredMemoryRef.current && dwellStartedAtRef.current) {
                const elapsed = now - dwellStartedAtRef.current;
                dwellProgress = Math.min(1, elapsed / DWELL_MS);
                if (
                  dwellProgress >= 1 &&
                  now - lastClickAtRef.current > CLICK_COOLDOWN_MS
                ) {
                  lastClickAtRef.current = now;
                  // Reset so we don't immediately re-trigger
                  dwellStartedAtRef.current = null;
                  window.dispatchEvent(
                    new CustomEvent("echo-select", {
                      detail: { memoryId: hoveredMemoryRef.current },
                    }),
                  );
                }
              }

              // Cursor visual — wrap holds the position; dot styles change
              if (wrap) {
                wrap.style.transform = `translate(${cursorX - 24}px, ${cursorY - 24}px)`;
                wrap.style.opacity = "1";
              }
              if (cursor) {
                if (isPinching) {
                  cursor.style.backgroundColor = "rgba(157, 220, 255, 0.85)";
                  cursor.style.boxShadow =
                    "0 0 36px 14px rgba(79, 195, 255, 0.7)";
                  cursor.style.scale = "1.15";
                } else if (hoveredMemoryRef.current) {
                  cursor.style.backgroundColor = "rgba(255, 215, 130, 0.55)";
                  cursor.style.boxShadow =
                    "0 0 28px 10px rgba(255, 200, 100, 0.45)";
                  cursor.style.scale = "1.05";
                } else {
                  cursor.style.backgroundColor = "rgba(79, 195, 255, 0.4)";
                  cursor.style.boxShadow =
                    "0 0 28px 8px rgba(79, 195, 255, 0.5)";
                  cursor.style.scale = "1";
                }
              }

              // Dwell ring fill (SVG stroke-dashoffset)
              if (ring) {
                const c = 2 * Math.PI * 22;
                ring.style.strokeDasharray = `${c}`;
                ring.style.strokeDashoffset = `${c * (1 - dwellProgress)}`;
                ring.style.opacity = dwellProgress > 0 ? "1" : "0";
              }

              // Pinch click — rising edge fires once, uses LATCHED position
              if (
                isPinching &&
                !wasPinchingRef.current &&
                now - lastClickAtRef.current > CLICK_COOLDOWN_MS
              ) {
                lastClickAtRef.current = now;
                const clickX = latchedPosRef.current?.x ?? cursorX;
                const clickY = latchedPosRef.current?.y ?? cursorY;
                const el = document.elementFromPoint(
                  clickX,
                  clickY,
                ) as HTMLElement | null;
                if (el?.tagName === "CANVAS") {
                  window.dispatchEvent(
                    new CustomEvent("echo-pinch", {
                      detail: { x: clickX, y: clickY },
                    }),
                  );
                } else {
                  el?.click();
                }
              }
              wasPinchingRef.current = isPinching;

              // Region hover (uses smoothed cursor position)
              const hoverEl = document.elementFromPoint(
                cursorX,
                cursorY,
              ) as HTMLElement | null;
              const region = (hoverEl?.dataset.region ?? null) as
                | MemoryCategory
                | null;
              if (region !== lastRegionRef.current) {
                lastRegionRef.current = region;
                onRegion(region);
              }
            } else {
              if (wrap) wrap.style.opacity = "0";
              if (ring) ring.style.opacity = "0";
              smoothPosRef.current.initialized = false;
              wasPinchingRef.current = false;
              latchedPosRef.current = null;
              hoveredMemoryRef.current = null;
              dwellStartedAtRef.current = null;
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
        ref={cursorWrapRef}
        className="pointer-events-none fixed left-0 top-0 z-50 h-12 w-12"
        style={{ opacity: 0 }}
      >
        <div
          ref={cursorDotRef}
          className="absolute left-1.5 top-1.5 h-9 w-9 rounded-full transition-[background-color,box-shadow,scale] duration-150 ease-out"
          style={{
            backgroundColor: "rgba(79, 195, 255, 0.4)",
            boxShadow: "0 0 28px 8px rgba(79, 195, 255, 0.5)",
          }}
        />
        <svg
          className="absolute inset-0 h-12 w-12"
          viewBox="0 0 48 48"
        >
          <circle
            ref={dwellRingRef}
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="rgba(255, 215, 130, 0.95)"
            strokeWidth="2"
            strokeLinecap="round"
            transform="rotate(-90 24 24)"
            style={{
              transition: "opacity 0.15s ease-out",
              filter: "drop-shadow(0 0 6px rgba(255, 200, 100, 0.6))",
              opacity: 0,
            }}
          />
        </svg>
      </div>
      <div className="absolute right-4 top-32 z-40 max-w-[12rem] rounded bg-charcoal-800/80 px-2 py-1 text-xs text-amber-glow/80">
        {status === "loading" && "Loading hand tracker…"}
        {status === "ready" && (
          <>
            <div>👆 Hover a memory to select</div>
            <div className="mt-0.5 text-amber-glow/50">🤏 Pinch = instant</div>
          </>
        )}
        {status === "error" && (
          <span className="text-red-300">Camera error: {errorMsg}</span>
        )}
      </div>
    </>
  );
}
