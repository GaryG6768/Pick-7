"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const PLAYER_NAMES = [
  "Gary G",
  "Nic G",
  "Neil B",
  "Matt D",
  "Nigel R",
  "Dave B",
  "Steve B",
  "David T",
  "Nick R",
  "Sean G",
  "Keith G",
  "David S",
  "Garrie W",
  "Darren W",
  "Gina A",
  "Gary P",
  "Bob B",
  "Mark B",
];

export default function PlayersAdmin() {
  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading...");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    const {
      data: { user },
    } = await supabase().auth.getUser();

    if (!user) {
      setMessage("Please sign in as the administrator.");
      return;
    }

    const { data: profile, error: profileError } = await supabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      setMessage("Administrator access required.");
      return;
    }

    const { data, error } = await supabase()
      .from("profiles")
      .select("id,display_name,is_admin")
      .order("display_name");

    if (error) {
      setMessage("Could not load players: " + error.message);
      return;
    }

    setPlayers(data || []);
    setMessage("");
  }

  async function addPlayer() {
    if (!name.trim()) {
      setMessage("Enter a player name.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setAdding(true);
    setMessage("Creating player...");

    const { data, error } = await supabase().functions.invoke(
      "create-pick7-player",
      {
        body: {
          display_name: name.trim(),
          password,
        },
      }
    );

    if (error) {
      setMessage("Could not create player: " + error.message);
      setAdding(false);
      return;
    }

    if (!data?.success) {
      setMessage(
        "Could not create player: " +
          (data?.error || "Unknown error")
      );
      setAdding(false);
      return;
    }

    setName("");
    setPassword("");
    setMessage(`${data.display_name} has been created successfully.`);
    setAdding(false);

    loadPlayers();
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>

        <h2>Players</h2>

        <p>
          Create and manage the Pick 7 player accounts.
        </p>

        <input
          type="text"
          placeholder="Player name"
          value={name}
          onChange={e => setName(e.target.value)}
          list="player-names"
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8,
          }}
        />

        <datalist id="player-names">
          {PLAYER_NAMES.map(player => (
            <option key={player} value={player} />
          ))}
        </datalist>

        <input
          type="password"
          placeholder="Initial password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8,
          }}
        />

        <button
          className="btn"
          onClick={addPlayer}
          disabled={adding}
        >
          {adding ? "CREATING..." : "ADD PLAYER"}
        </button>

        {message && (
          <div className="notice" style={{ marginTop: 20 }}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Current Players</h3>

        {players.length === 0 ? (
          <p className="muted">
            No players found.
          </p>
        ) : (
          players.map(player => (
            <div
              key={player.id}
              style={{
                padding: 12,
                marginBottom: 8,
                border: "1px solid #42627e",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{player.display_name}</span>

              {player.is_admin && (
                <span className="muted">
                  ADMIN
                </span>
              )}
            </div>
          ))
        )}
      </div>

    </main>
  );
}
