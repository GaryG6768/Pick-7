import "./globals.css";
import Nav from "./Nav";

export const metadata = {
  title: "Pick 7",
  description: "Seven matches. One weekly challenge.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="appHeader">
          <div className="logo7" aria-hidden="true">
            7
          </div>

          <div>
            <div className="brand">
              PICK 7
            </div>

            <div className="tag">
              Seven matches. One weekly challenge.
            </div>
          </div>
        </header>

        <Nav />

        <main>{children}</main>
      </body>
    </html>
  );
}
