"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function AdminPage() {
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [players, setPlayers] = useState([]);

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPassword, setNewPlayerPassword] = useState("");
  const [newPlayerSeason, setNewPlayerSeason] = useState(true);

  const [message, setMessage] = useState("Checking admin access...");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const db = supabase();

      const {
        data: { session }
      } = await db.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setMessage("Please sign in as the Pick 7 administrator.");
        return;
      }

      await checkAdmin(session.user);
    } catch (error) {
      setUser(null);
      setMessage(
        error?.message || "Unable to check administrator access."
      );
    }
  }

  async function checkAdmin(currentUser) {
    const db = supabase();

    const {
      data: profile,
      error
    } = await db
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (error || !profile?.is_admin) {
      await db.auth.signOut();
      setUser(null);
      setMessage(
        "This account is not authorised as a Pick 7 administrator."
      );
      return;
    }

    setUser(currentUser);
    setMessage("");
    loadPlayers();
  }

  async function signIn() {
    if (!email.trim() || !password) {
      setMessage("Enter your admin email address and password.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Signing in...");

      const db = supabase();

      const {
        data,
        error
      } = await db.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (error) {
        setMessage("Sign-in failed: " + error.message);
        return;
      }

      await checkAdmin(data.user);
    } catch (error) {
      setMessage(
        error?.message || "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase().auth.signOut();

    setUser(null);
    setPassword("");
    setMessage("Signed out.");
  }

  async function loadPlayers() {
    try {
      const db = supabase();

      const {
        data,
        error
      } = await db
        .from("profiles")
        .select(
          "id, display_name, active, season_league, season_league_start_round, is_admin"
        )
        .order("display_name", {
          ascending: true
        });

      if (error) {
        setMessage(
          "Could not load players: " + error.message
        );
        return;
      }

      setPlayers(data || []);
    } catch (error) {
      setMessage(
        error?.message || "Unable to load players."
      );
    }
  }

  async function addPlayer() {
    const name = newPlayerName.trim();
    const playerPassword = newPlayerPassword;

    if (!name) {
      setMessage("Enter the player's name.");
      return;
    }

    if (playerPassword.length < 6) {
      setMessage(
        "Player password must be at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("Adding player...");

      const db = supabase();

      const {
        data,
        error
      } = await db.functions.invoke(
        "admin-create-player",
        {
          body: {
            display_name: name,
            password: playerPassword,
            season_league: newPlayerSeason
          }
        }
      );

      if (error) {
        throw new Error(
          error.message || "Could not add player."
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setNewPlayerName("");
      setNewPlayerPassword("");
      setNewPlayerSeason(true);

      setMessage(
        `${name} has been added successfully.`
      );

      await loadPlayers();
    } catch (error) {
      setMessage(
        error?.message || "Could not add player."
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeActiveStatus(player) {
    const newActiveStatus = !player.active;

    try {
      setLoading(true);

      setMessage(
        newActiveStatus
          ? `Reactivating ${player.display_name}...`
          : `Removing ${player.display_name} from active players...`
      );

      const db = supabase();

      const {
        data,
        error
      } = await db.functions.invoke(
        "admin-update-player",
        {
          body: {
            player_id: player.id,
            active: newActiveStatus
          }
        }
      );

      if (error) {
        throw new Error(
          error.message || "Could not update player."
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessage(
        newActiveStatus
          ? `${player.display_name} has been reactivated.`
          : `${player.display_name} has been removed from active players.`
      );

      await loadPlayers();
    } catch (error) {
      setMessage(
        error?.message || "Could not update player."
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeSeasonLeague(player) {
    try {
      setLoading(true);

      const newValue = !player.season_league;

      setMessage(
        newValue
          ? `Adding ${player.display_name} to the Season League...`
          : `Removing ${player.display_name} from the Season League...`
      );

      const db = supabase();

      const {
        data,
        error
      } = await db.functions.invoke(
        "admin-update-player",
        {
          body: {
            player_id: player.id,
            season_league: newValue
          }
        }
      );

      if (error) {
        throw new Error(
          error.message || "Could not update player."
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setMessage(
        newValue
          ? `${player.display_name} is now in the Season League.`
          : `${player.display_name} has been removed from the Season League.`
      );

      await loadPlayers();
    } catch (error) {
      setMessage(
        error?.message || "Could not update player."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            PICK 7 ADMIN
          </div>

          <h2>
            Administrator Sign-in
          </h2>

          <p className="muted">
            Sign in to manage Pick 7 players.
          </p>

          <input
            type="email"
            placeholder="Admin email address"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
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

          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                signIn();
              }
            }}
            autoComplete="current-password"
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

          <button
            className="btn"
            onClick={signIn}
            disabled={loading}
          >
            {loading ? "SIGNING IN..." : "SIGN IN"}
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
      </main>
    );
  }

  const activePlayers = players.filter(
    player => player.active !== false
  );

  const seasonPlayers = players.filter(
    player =>
      player.active !== false &&
      player.season_league === true
  );

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">
          PICK 7 ADMIN
        </div>

        <h2>
          Player Management
        </h2>

        <p className="muted">
          Manage Pick 7 players and Season League
          membership.
        </p>

        <button
          className="btn"
          onClick={logout}
          disabled={loading}
        >
          SIGN OUT
        </button>
      </div>

      <div className="card">
        <div className="muted">
          PLAYER MANAGEMENT
        </div>

        <h3>
          Add New Player
        </h3>

        <p className="muted">
          Create a player account and give them
          their Pick 7 password.
        </p>

        <label>
          <strong>Player name</strong>
        </label>

        <input
          type="text"
          placeholder="Enter player name"
          value={newPlayerName}
          onChange={(e) =>
            setNewPlayerName(e.target.value)
          }
          autoComplete="off"
          style={{
            width: "100%",
            padding: 12,
            marginTop: 8,
            marginBottom: 14,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8
          }}
        />

        <label>
          <strong>Player password</strong>
        </label>

        <input
          type="password"
          placeholder="Minimum 6 characters"
          value={newPlayerPassword}
          onChange={(e) =>
            setNewPlayerPassword(e.target.value)
          }
          autoComplete="new-password"
          style={{
            width: "100%",
            padding: 12,
            marginTop: 8,
            marginBottom: 14,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8
          }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16
          }}
        >
          <input
            type="checkbox"
            checked={newPlayerSeason}
            onChange={(e) =>
              setNewPlayerSeason(
                e.target.checked
              )
            }
            style={{
              width: 20,
              height: 20
            }}
          />

          <span>
            <strong>Include in Season League</strong>
          </span>
        </label>

        <button
          className="btn"
          onClick={addPlayer}
          disabled={loading}
        >
          {loading ? "ADDING PLAYER..." : "ADD PLAYER"}
        </button>

        {message && (
          <div
            className="notice"
            style={{ marginTop: 16 }}
          >
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>
          Player Summary
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 10
          }}
        >
          <div
            style={{
              padding: 14,
              border: "1px solid #42627e",
              borderRadius: 10
            }}
          >
            <div className="muted">
              ACTIVE PLAYERS
            </div>

            <strong
              style={{
                fontSize: 26
              }}
            >
              {activePlayers.length}
            </strong>
          </div>

          <div
            style={{
              padding: 14,
              border: "1px solid #42627e",
              borderRadius: 10
            }}
          >
            <div className="muted">
              SEASON LEAGUE
            </div>

            <strong
              style={{
                fontSize: 26
              }}
            >
              {seasonPlayers.length}
            </strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>
          Players
        </h3>

        {players.length === 0 ? (
          <p className="muted">
            No players found.
          </p>
        ) : (
          <div>
            {players.map(player => (
              <div
                key={player.id}
                style={{
                  padding: 14,
                  marginTop: 10,
                  border: "1px solid #42627e",
                  borderRadius: 10
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    gap: 10
                  }}
                >
                  <div>
                    <strong
                      style={{
                        fontSize: 18
                      }}
                    >
                      {player.display_name ||
                        "Unnamed player"}
                    </strong>

                    {player.is_admin && (
                      <div className="muted">
                        Administrator
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      textAlign: "right"
                    }}
                  >
                    <div>
                      {player.active === false
                        ? "🔴 Inactive"
                        : "🟢 Active"}
                    </div>

                    <div className="muted">
                      {player.season_league
                        ? "🏆 Season League"
                        : "Not in Season League"}
                    </div>
                  </div>
                </div>

                {!player.is_admin && (
                  <>
                    <button
                      className="btn"
                      onClick={() =>
                        changeActiveStatus(
                          player
                        )
                      }
                      disabled={loading}
                      style={{
                        marginTop: 12,
                        background:
                          player.active === false
                            ? undefined
                            : "#b42318"
                      }}
                    >
                      {player.active === false
                        ? "REACTIVATE PLAYER"
                        : "REMOVE PLAYER"}
                    </button>

                    {player.active !== false && (
                      <button
                        className="btn"
                        onClick={() =>
                          changeSeasonLeague(
                            player
                          )
                        }
                        disabled={loading}
                        style={{
                          marginTop: 10
                        }}
                      >
                        {player.season_league
                          ? "REMOVE FROM SEASON LEAGUE"
                          : "ADD TO SEASON LEAGUE"}
                      </button>
                    )}
                  </>
                )}

                {player.season_league &&
                  player.season_league_start_round && (
                    <div
                      className="muted"
                      style={{
                        marginTop: 8
                      }}
                    >
                      Season starts from
                      Round{" "}
                      {
                        player.season_league_start_round
                      }
                    </div>
                  )}
              </
