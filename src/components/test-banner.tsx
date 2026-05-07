export function TestBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono-data" style={{ background: "rgba(99,143,255,0.1)", color: "#638FFF" }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: "#638FFF" }} />
      Devnet
    </span>
  );
}
