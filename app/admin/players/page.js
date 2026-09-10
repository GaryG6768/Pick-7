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
  const [seasonLeague, setSeasonLeague] = useState(true);
  const [message, setMessage] = useState("Loading...");
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(null);

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
      .select(
        "id,display_name,is_admin,active,season_league,season_league_start_round"
      )
      .order("display_name");

    if (error) {
      setMessage("Could not load players: " + error.message);
      return;
    }

    setPlayers(data || []);
    setMessage("");
  }

  async function addPlayer() {
    if (!name) {
      setMessage("Select a player name.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setAdding(true);
    setMessage("Creating player...");

    const { data, error } = await supabase().functions.invoke(
      "admin-create-player",
      {
        body: {
          display_name: name,
          password,
          season_league: seasonLeague,
        },
      }
    );

    if (error) {
      setMessage("Could not create player: " + error.message);
      setAdding(false);
      return;
    }

    if (!data?.ok) {
      setMessage(
        "Could not create player: " +
          (data?.error || "Unknown error")
      );
      setAdding(false);
      return;
    }

    setPlayers((prev) => [
      ...prev,
      {
        id: data.player_id,
        display_name: data.display_name,
        is_admin: false,
        active: true,
        season_league: data.season_league,
        season_league_start_round:
          data.season_league_start_round,
      },
    ]);

    setName("");
    setPassword("");
    setSeasonLeague(true);

    setMessage(
      `${data.display_name} has been created successfully.`
    );

    setAdding(false);
  }

  async function toggleSeasonLeague(player) {
    const newValue = !player.season_league;

    setUpdating(player.id);

    setMessage(
      newValue
        ? `${player.display_name} is joining the Season League...`
        : `${player.display_name} is being removed from the Season League...`
    );

    const { data, error } = await supabase().functions.invoke(
      "admin-update-player",
      {
        body: {
          player_id: player.id,
          season_league: newValue,
        },
      }
    );

    if (error) {
      setMessage(
        "Could not update player: " + error.message
      );
      setUpdating(null);
      return;
    }

    if (!data?.ok) {
      setMessage(
        "Could not update player: " +
          (data?.error || "Unknown error")
      );
      setUpdating(null);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === player.id
          ? {
              ...p,
              season_league:
                data.player.season_league,
              season_league_start_round:
                data.player.season_league_start_round,
            }
          : p
      )
    );

    setMessage(
      newValue
        ? `${player.display_name} has joined the Season League.`
        : `${player.display_name} has been removed from the Season League.`
    );

    setUpdating(null);
  }

  const existingNames = players.map(
    (player) => player.display_name
  );

  const availablePlayers = PLAYER_NAMES.filter(
    (player) => !existingNames.includes(player)
  );

  return (
    <main className="wrap">

      <div className="card">

        <div className="muted">
          PICK 7 ADMIN
        </div>

        <h2>Players</h2>

        <p>
          Create and manage the Pick 7 player accounts.
        </p>

        <select
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8,
            fontSize: 16,
          }}
        >

          <option value="">
            Select player name
          </option>

          {availablePlayers.map((player) => (
            <option
              key={player}
              value={player}
            >
              {player}
            </option>
          ))}

        </select>

        <input
          type="password"
          placeholder="Initial password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8,
            fontSize: 16,
          }}
        />

        <div
          style={{
            padding: 14,
            marginBottom: 12,
            border: "1px solid #42627e",
            borderRadius: 8,
            background: "#07111f",
          }}
        >

          <div
            style={{
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Season League
          </div>

          <select
            value={seasonLeague ? "yes" : "no"}
            onChange={(e) =>
              setSeasonLeague(
                e.target.value === "yes"
              )
            }
            style={{
              width: "100%",
              padding: 12,
              background: "#102238",
              color: "white",
              border: "1px solid #42627e",
              borderRadius: 8,
              fontSize: 16,
            }}
          >

            <option value="yes">
              YES — Include in Season League
            </option>

            <option value="no">
              NO — Pick 7 only
            </option>

          </select>

        </div>

        <button
          className="btn"
          onClick={addPlayer}
          disabled={adding || !name}
        >
          {adding
            ? "CREATING..."
            : "ADD PLAYER"}
        </button>

        {message && (
          <div
            className="notice"
            style={{ marginTop: 20 }}
          >
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
          players.map((player) => (

            <div
              key={player.id}
              style={{
                padding: 14,
                marginBottom: 10,
                border: "1px solid #42627e",
                borderRadius: 10,
                background: "#07111f",
              }}
            >

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >

                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  {player.display_name}
                </span>

                {player.is_admin && (
                  <span className="muted">
                    ADMIN
                  </span>
                )}

              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >

                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: player.season_league
                      ? "#25d477"
                      : "#a9b8c4",
                  }}
                >
                  {player.season_league
                    ? "🏆 SEASON LEAGUE"
                    : "⚽ PICK 7 ONLY"}
                </span>

                {!player.is_admin && (
                  <button
                    className="btn"
                    onClick={() =>
                      toggleSeasonLeague(player)
                    }
                    disabled={
                      updating === player.id
                    }
                    style={{
                      minHeight: 40,
                      padding: "8px 12px",
                      fontSize: 12,
                    }}
                  >
                    {updating === player.id
                      ? "UPDATING..."
                      : player.season_league
                      ? "REMOVE"
                      : "JOIN LEAGUE"}
                  </button>
                )}

              </div>

              {player.season_league &&
                player.season_league_start_round && (
                  <div
                    className="muted"
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                    }}
                  >
                    Season League points count from Round{" "}
                    {player.season_league_start_round}.
                  </div>
                )}

            </div>

          ))
        )}

      </div>

    </main>
  );
}
