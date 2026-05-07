"use client";

import { useEffect, useState } from "react";

const BOLT_PATH = "M 60 0 L -30 110 L 10 110 L -20 200 L 70 70 L 30 70 L 60 0 Z";

interface ShardConfig {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  clip: string;
  fill: string;
}

const SHARDS: ShardConfig[] = [
  {
    dx: -600, dy: -150, rot: -45, delay: 0,
    clip: "polygon(0% 0%, 100% 0%, 100% 35%, 0% 35%)",
    fill: "linear-gradient(135deg, #14b8a6, #0ea5e9)",
  },
  {
    dx: -720, dy: 50, rot: 30, delay: 0.12,
    clip: "polygon(0% 35%, 100% 35%, 100% 60%, 0% 60%)",
    fill: "linear-gradient(135deg, #0d9488, #1e3a8a)",
  },
  {
    dx: -840, dy: -60, rot: -20, delay: 0.24,
    clip: "polygon(0% 60%, 100% 60%, 100% 80%, 0% 80%)",
    fill: "linear-gradient(135deg, #2dd4bf, #1e40af)",
  },
  {
    dx: -700, dy: 120, rot: 50, delay: 0.36,
    clip: "polygon(0% 80%, 100% 80%, 100% 100%, 0% 100%)",
    fill: "linear-gradient(135deg, #06b6d4, #1d4ed8)",
  },
];

function BoltSVG({
  fill,
  clipPath,
  id,
}: {
  fill: string;
  clipPath?: string;
  id: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        inset: 0,
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
          <clipPath id={`heroClip-${id}`}>
            <path d={BOLT_PATH} />
          </clipPath>
        </defs>
        <foreignObject
          x="-40"
          y="-10"
          width="120"
          height="220"
          clipPath={`url(#heroClip-${id})`}
        >
          <div style={{ width: "100%", height: "100%", background: fill }} />
        </foreignObject>
        <path
          d={BOLT_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.6"
        />
      </svg>
    </div>
  );
}

export function HeroBoltAnimation() {
  const [phase, setPhase] = useState<
    "init" | "assemble" | "assembled" | "pulse" | "idle"
  >("init");

  useEffect(() => {
    const t0 = setTimeout(() => setPhase("assemble"), 200);
    const t1 = setTimeout(() => setPhase("assembled"), 1200);
    const t2 = setTimeout(() => setPhase("pulse"), 1500);
    const t3 = setTimeout(() => setPhase("idle"), 4200);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const showShards = phase === "assemble";
  const showAssembled =
    phase === "assembled" ||
    phase === "pulse" ||
    phase === "idle";
  const showPulse =
    phase === "pulse" ||
    phase === "idle";

  return (
    <div className="hero-bolt-wrapper">
      {/* Ambient background glow */}
      <div className="hero-bolt-ambient" />

      {/* Bolt container */}
      <div className="hero-bolt-stage">
        <div
          className={`hero-bolt-scale ${showAssembled ? "hero-bolt-impact" : ""}`}
        >
          {/* Phase 1: Shards flying in */}
          {showShards &&
            SHARDS.map((s, i) => (
              <div
                key={i}
                className="hero-shard"
                style={{
                  position: "absolute",
                  inset: 0,
                  animationDelay: `${s.delay}s`,
                  ["--shard-dx" as string]: `${s.dx}px`,
                  ["--shard-dy" as string]: `${s.dy}px`,
                  ["--shard-rot" as string]: `${s.rot}deg`,
                }}
              >
                <BoltSVG fill={s.fill} clipPath={s.clip} id={`hero-s-${i}`} />
              </div>
            ))}

          {/* Assembled bolt with gradient */}
          {showAssembled && (
            <div
              className={`hero-bolt-assembled ${showPulse ? "hero-bolt-pulse-glow" : ""}`}
            >
              <BoltSVG
                fill={
                  showPulse
                    ? "linear-gradient(160deg, #00ffd1, #9945ff, #14f195, #00d4ff)"
                    : "linear-gradient(135deg, #14b8a6, #1e40af)"
                }
                id="hero-main"
              />
            </div>
          )}

          {/* Inner highlight */}
          {showAssembled && (
            <div className="hero-bolt-highlight">
              <BoltSVG
                fill="linear-gradient(180deg, rgba(255,255,255,0.5), transparent 60%)"
                id="hero-hl"
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
