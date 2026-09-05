import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Pick 7",
  description: "Seven matches. One weekly challenge.",
  manifest: "/manifest.json",
};

export default function Layout({ children }) {
  return (
    <>
      <header className="appHeader">
        <div className="logo7">7</div>

        <div>
          <div className="brand">PICK 7</div>

          <div className="tag">
            Seven matches. One weekly challenge.
          </div>
        </div>
      </header>

      <nav className="nav">

        <Link href="/">
          ⚽
          <small>Play</small>
        </Link>

        <Link href="/history">
          📜
          <small>History</small>
        </Link>

        <Link href="/competition">
          🏆
          <small>5 Rounds</small>
        </Link>

        <Link href="/season">
          📊
          <small>Season</small>
        </Link>

        <a href="/admin">
          ⚙️
          <small>Admin</small>
        </a>

      </nav>

      {children}
    </>
  );
}
