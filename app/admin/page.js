"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [rounds, setRounds] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const db = supabase();

    const { data: roundData, error: roundError } = await db
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    if (roundError) {
      setMessage("Rounds error: " + roundError.message);
    } else {
      setRounds(roundData || []);
    }

    const { data: fixtureData, error: fixtureError } = await db
      .from("fixtures")
      .select("*")
      .order("kickoff", { ascending: true });

    if (fixtureError) {
      setMessage("Fixtures error: " + fixtureError.message);
    } else {
      setFixtures(fixtureData || []);
    }

    setLoading(false);
  }

  async function createRound() {
    setMessage("");

    const db = supabase();

    if (fixtures.length < 7) {
      setMessage("There are not yet 7 fixtures in the database.");
      return;
    }

    const nextRound =
      rounds.length > 0
        ? Math.max(...rounds.map((r) => Number(r.round_number) || 0)) + 1
        : 1;

    const { data: round, error: roundError } = await db
      .from("rounds")
      .insert({
        round_number: nextRound,
        status: "open"
      })
      .select()
      .single();

    if (roundError) {
      setMessage("Could not create round: " + roundError.message);
      return;
    }

    const shuffled = [...fixtures].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 7);

    const links = selected.map((fixture, index) => ({
      round_id: round.id,
      fixture_id: fixture.id,
      fixture_number: index + 1
    }));

    const { error: linkError } = await db
      .from("round_fixtures")
      .insert(links);

    if (linkError) {
      setMessage("Round created, but fixtures could not be added: " + linkError.message);
      return;
    }

    setMessage("ROUND " + nextRound + " CREATED — 7 fixtures selected.");

    loadData();
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>

        <p>
          Create a new Pick 7 round and randomly select seven Premier League
          fixtures.
        </p>

        <button className="btn" onClick={createRound}>
          CREATE NEW ROUND
        </button>

        <br />
        <br />

        <button className="btn" onClick={loadData}>
          REFRESH DATABASE
        </button>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Rounds</h3>

        {loading && <p className="muted">Loading...</p>}

        {!loading && rounds.length === 0 && (
          <p className="muted">No rounds have been created yet.</p>
        )}

        {!loading &&
          rounds.map((round) => (
            <div className="fixture" key={round.id}>
              <strong>ROUND {round.round_number}</strong>
              <span className="muted">{round.status}</span>
            </div>
          ))}
      </div>

      <div className="card">
        <h3>Fixtures in database</h3>

        {fixtures.length === 0 && (
          <p className="muted">
            No fixtures have been loaded yet.
          </p>
        )}

        {fixtures.slice(0, 20).map((fixture) => (
          <div className="fixture" key={
