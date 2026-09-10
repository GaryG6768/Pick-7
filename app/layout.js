import "./globals.css";
import Nav from "./Nav";

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
          <div className="brand">
            PICK 7
          </div>

          <div className="tag">
            Seven matches. One weekly challenge.
          </div>
        </div>
      </header>

      <Nav />

      {children}

      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", function () {
                navigator.serviceWorker.register("/sw.js");
              });
            }
          `,
        }}
      />
    </>
  );
}
