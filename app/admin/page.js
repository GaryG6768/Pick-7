"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [rounds, setRounds] = useState([]);
  const [message, setMessage] = useState("Loading...");
  const [roundNumber, setRoundNumber] = useState("");

  async function loadRounds() {
    setMessage("Loading rounds...");

    const { data, error } = await supabase()
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    if (error) {
      setMessage("Database error: " + error.message);
      return;
    }

    setRounds(data || []);
    setMessage("");
  }

  useEffect(() => {
    loadRounds();
  }, []);

  async function createRound() {
    if (!roundNumber) {
      setMessage("Enter a round number.");
      return;
    }

    setMessage("Creating round...");

    const { error } = await supabase().rpc(
      "create_pick7_round",
      { p_round_number: Number(roundNumber) }
    );

    if (error) {
      setMessage("Could not create round: " + error.message);
      return;
    }

    setMessage("Round created successfully.");
    setRoundNumber("");
    loadRounds();
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>

        <p>Create and manage Pick 7 rounds.</p>

        <h3>Create New Round</h3>

        <input
          type="number"
          placeholder="Round number"
          value={roundNumber}
          onChange={(e) => setRoundNumber(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8
          }}
        />

        <button className="btn" onClick={createRound}>
          CREATE ROUND
        </button>

        {message && (
          <div className="notice" style={{ marginTop: 20 }}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Existing Rounds</h3>

        {rounds.length === 0 ? (
          <p className="muted">No rounds have been created yet.</p>
        ) : (
          rounds.map((round) => (
            <div
              key={round.id}
              style={{
                padding: 14,
                marginBottom: 10,
                border: "1px solid #42627e",
                borderRadius: 8
              }}
            >
              <strong>Round {round.round_number}</strong>
              <br />
              <span className="muted">
                Status: {round.status}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
