"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [rounds, setRounds] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [message, setMessage] = useState("Loading...");

  async function load() {
    const db = supabase();

    const r = await db
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    const f = await db
      .from("fixtures")
      .select("*")
      .order("kickoff", { ascending: true });

    if (r.error) {
      setMessage("Rounds error: " + r.error.message);
      return;
    }

    if (f.error) {
      setMessage("Fixtures error: " + f.error.message);
      return;
    }

    setRounds(r.data || []);
    setFixtures(f.data || []);
    setMessage("Database loaded.");
  }

  useEffect(() => {
    load();
  }, []);

  async function newRound() {
    if (fixtures.length < 7) {
      setMessage("Need at least 7 fixtures.");
      return;
    }

    const db = supabase();

    const next =
      rounds.length
        ? Math.max(...rounds.map(x => Number(x.round_number) || 0)) + 1
        : 1;

    const r = await db
      .from("rounds")
      .insert({ round_number: next, status: "open" })
      .select()
      .single();

    if (r.error) {
      setMessage("Round error: " + r.error.message);
      return;
    }

    const selected = [...fixtures]
      .sort(() => Math.random() - 0.5)
      .slice(0, 7);

    const links = selected.map((x, i) => ({
      round_id: r.data.id,
      fixture_id: x.id,
      fixture_number: i + 1
    }));

    const result = await db
      .from("round_fixtures")
      .insert(links);

    if (result.error) {
      setMessage("Fixture error: " + result.error.message);
      return;
    }

    setMessage("ROUND " + next + " CREATED.");
    load();
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>

        <button className="btn" onClick={newRound}>
          CREATE NEW ROUND
        </button>

        <br />
        <br />

        <button className="btn" onClick={load}>
          REFRESH
        </button>

        <div className="notice">{message}</div>
      </div>

      <div className="card">
        <h3>Rounds</h3>

        {rounds.map(x => (
          <div className="fixture" key={x.id}>
            <strong>ROUND {x.round_number}</strong>
            <span className="muted">{x.status}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Fixtures</h3>

        {fixtures.slice(0, 20).map(x => (
          <div className="fixture" key={x.id}>
            <strong>{x.home_team} v {x.away_team}</strong>
            <div className="muted">
              {x.kickoff ? new Date(x.kickoff).toLocaleString() : ""}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
