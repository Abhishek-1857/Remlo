"use client";

import { useEffect, useState } from "react";

const BOLT_PATH = "M 60 0 L -30 110 L 10 110 L -20 200 L 70 70 L 30 70 L 60 0 Z";

const SHARD_CLIPS = [
  "polygon(0% 0%, 100% 0%, 100% 35%, 0% 35%)",
  "polygon(0% 35%, 100% 35%, 100% 60%, 0% 60%)",
  "polygon(0% 60%, 100% 60%, 100% 80%, 0% 80%)",
  "polygon(0% 80%, 100% 80%, 100% 100%, 0% 100%)",
];

const SHARD_OFFSETS = [
  { dx: -300, dy: -80, rot: -45 },
  { dx: -360, dy: 30, rot: 30 },
  { dx: -400, dy: -40, rot: -20 },
  { dx: -340, dy: 60, rot: 50 },
];

const SHARD_FILLS = [
  "linear-gradient(135deg, #33E49B, #00E6A0)",
  "linear-gradient(135deg, #00E6A0, #0B8A52)",
  "linear-gradient(135deg, #33E49B, #14b8a6)",
  "linear-gradient(135deg, #00E6A0, #06b6d4)",
];

function BoltSVG({
  fill,
  clipPath,
  size,
  id,
}: {
  fill: string;
  clipPath?: string;
  size: number;
  id: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size * 2,
        position: "relative",
        clipPath,
      }}
    >
      <svg
        viewBox="-40 -10 120 220"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={`boltClip-${id}`}>
            <path d={BOLT_PATH} />
          </clipPath>
        </defs>
        <foreignObject
          x="-40"
          y="-10"
          width="120"
          height="220"
          clipPath={`url(#boltClip-${id})`}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: fill,
            }}
          />
        </foreignObject>
        <path
          d={BOLT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}

export function BoltAnimation({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const [phase, setPhase] = useState<"assemble" | "pulse" | "idle">("assemble");
  const [assembled, setAssembled] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setAssembled(true);
    }, 800);
    const t2 = setTimeout(() => {
      setPhase("pulse");
    }, 1000);
    const t3 = setTimeout(() => {
      setPhase("idle");
    }, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div
      className={`bolt-anim-container ${className}`}
      style={{
        position: "relative",
        width: size,
        height: size * 2,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Shards flying in */}
      {!assembled &&
        SHARD_CLIPS.map((clip, i) => (
          <div
            key={i}
            className="bolt-shard"
            style={{
              position: "absolute",
              inset: 0,
              animation: `bolt-shard-fly 0.7s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.1}s both`,
              ["--shard-dx" as string]: `${SHARD_OFFSETS[i].dx}px`,
              ["--shard-dy" as string]: `${SHARD_OFFSETS[i].dy}px`,
              ["--shard-rot" as string]: `${SHARD_OFFSETS[i].rot}deg`,
            }}
          >
            <BoltSVG
              fill={SHARD_FILLS[i]}
              clipPath={clip}
              size={size}
              id={`shard-${i}`}
            />
          </div>
        ))}

      {/* Assembled bolt */}
      <div
        className={phase === "pulse" ? "bolt-gradient-pulse" : phase === "idle" ? "bolt-idle-glow" : ""}
        style={{
          position: "absolute",
          inset: 0,
          opacity: assembled ? 1 : 0,
          transition: "opacity 0.3s ease-out",
          filter: assembled
            ? "drop-shadow(0 0 8px rgba(0,230,160,0.6)) drop-shadow(0 0 20px rgba(0,230,160,0.3))"
            : "none",
        }}
      >
        <BoltSVG
          fill="linear-gradient(160deg, #33E49B, #00E6A0, #14b8a6, #00E6A0)"
          size={size}
          id="assembled"
        />
      </div>

      {/* Inner highlight (screen blend) */}
      {assembled && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "screen",
            opacity: 0.5,
          }}
        >
          <BoltSVG
            fill="linear-gradient(180deg, rgba(255,255,255,0.5), transparent 60%)"
            size={size}
            id="highlight"
          />
        </div>
      )}

      {/* Swipe effect */}
      {phase === "pulse" && (
        <div
          className="bolt-swipe"
          style={{
            position: "absolute",
            top: "-20%",
            left: "-50%",
            width: "200%",
            height: "140%",
            background:
              "linear-gradient(90deg, transparent 0%, transparent 35%, rgba(255,255,255,0.7) 49%, rgba(0,230,160,0.6) 51%, transparent 65%)",
            transform: "rotate(20deg)",
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

export function BoltIconAnimated({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`bolt-idle-glow ${className}`}
      style={{
        width: size,
        height: size * 2,
        display: "inline-flex",
        filter: "drop-shadow(0 0 4px rgba(0,230,160,0.5))",
      }}
    >
      <svg
        viewBox="-40 -10 120 220"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id="boltClip-icon">
            <path d={BOLT_PATH} />
          </clipPath>
          <linearGradient id="boltGrad-icon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#33E49B" />
            <stop offset="50%" stopColor="#00E6A0" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <path
          d={BOLT_PATH}
          fill="url(#boltGrad-icon)"
        />
        <path
          d={BOLT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.6"
        />
      </svg>
    </div>
  );
}
