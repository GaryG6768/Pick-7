import "./globals.css";import Link from "next/link";
export const metadata={title:"Pick 7",description:"Seven matches. One weekly challenge."};
export default function Layout({children}){return <><header><b>PICK 7</b><span>Seven matches. One weekly challenge.</span></header><nav><Link href="/">Play</Link><Link href="/competition">5 Rounds</Link><Link href="/season">Season</Link><</nav>{children}</>}
<a href="/admin">Admin</a>
