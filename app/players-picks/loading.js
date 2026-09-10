"use client";

export default function Loading() {
  return (
    <main className="page">
      <section className="card">
        <h1>👥 Players' Picks</h1>

        <div
          style={{
            marginTop: 18,
            padding: 22,
            borderRadius: 12,
            background: "#101f2e",
            border: "1px solid #29465e",
            color: "#9db1c2",
            textAlign: "center",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ⏳ Loading players' picks...
        </div>
      </section>
    </main>
  );
}
