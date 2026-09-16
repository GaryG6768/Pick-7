"use client";

export default function Nav() {
  return (
    <nav className="nav">
      <a href="/">
        <span>⚽</span>
        <small>Play</small>
      </a>

      <a href="/history">
        <span>📜</span>
        <small>History</small>
      </a>

      <a href="/competition">
        <span>🏆</span>
        <small>5 Rounds</small>
      </a>

      <a href="/season">
        <span>📊</span>
        <small>Season</small>
      </a>

      <a href="/players-picks">
        <span>👥</span>
        <small>Picks</small>
      </a>
    </nav>
  );
}
