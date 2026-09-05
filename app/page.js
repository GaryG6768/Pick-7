"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [round, setRound] = useState(null);
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading Pick 7...");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadRound();
    checkUser();
  }, []);

  async function checkUser() {
    const { data } = await supabase().auth.getUser();
    setUser(data?.user || null);
  }

  async function loadRound() {
    try {
      setLoading(true);

      const db = supabase();

      const { data: roundData, error: roundError } = await db
        .from("rounds")
        .select("id, round_number, status")
        .eq("status", "open")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (roundError) throw roundError;

      if (!roundData) {
        setMessage("No round is currently open.");
        return;
      }

      const { data: links, error: linksError } = await db
        .from("round_fixtures")
        .select("fixture_number, fixture_id")
        .eq("round_id", roundData.id)
        .order("fixture_number", { ascending: true });

      if (linksError) throw linksError;

      const fixtureIds = (links || [])
        .map(x => x.fixture_id)
        .filter(Boolean);

      if (fixtureIds.length !== 7) {
        throw new Error(
          `This round contains ${fixtureIds.length} fixtures instead of 7.`
        );
      }

      const { data: fixtures, error: fixtureError } = await db
        .from("fixtures")
        .select("id, home_team, away_team, kickoff")
        .in("id", fixtureIds);

      if (fixtureError) throw fixtureError;

      const byId = Object.fromEntries(
        (fixtures || []).map(f => [f.id, f])
      );

      const orderedGames = (links || [])
        .map(x => byId[x.fixture_id])
        .filter(Boolean);

      if (orderedGames.length !== 7) {
        throw new Error("The 7 selected fixtures could not be loaded.");
      }

      setRound(roundData);
      setGames(orderedGames);
      setMessage("");
    } catch (error) {
      setMessage(
        "Unable to load Pick 7: " +
        (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  function setScore(id, side, value) {
    setPredictions(current => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [side]: value === "" ? "" : Number(value)
      }
    }));
  }

  async function signIn(event) {
    event.preventDefault();

    const { data, error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      setMessage("Sign-in failed: " + error.message);
      return;
    }

    setUser(data.user);
    setMessage("You are signed in. Enter your 7 predictions.");
  }

  async function createAccount() {
    if (!email || !password) {
      setMessage("Enter your email and password first.");
      return;
    }

    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      setMessage("Could not create account: " + error.message);
      return;
    }

    if (data.user && data.session) {
      setUser(data.user);
      setMessage("Account created. You can now enter your 7 predictions.");
    } else {
      setMessage(
        "Account created. Check your email to confirm your account, then sign in."
      );
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    setUser(null);
    setMessage("You have been signed out.");
  }

  async function submit() {
    if (!user) {
      setMessage("Please sign in before submitting your picks.");
      return;
    }

    if (!round || games.length !== 7) {
      setMessage("There is no valid Pick 7 round available.");
      return;
    }

    const incomplete = games.some(game => {
      const p = predictions[game.id];

      return (
        p?.home === undefined ||
        p?.away === undefined ||
        p?.home === "" ||
        p?.away === ""
      );
    });

    if (incomplete) {
      setMessage("Please enter all 7 scores.");
      return;
    }

    const rows = games.map(game => ({
      round_id: round.id,
      fixture_id: game.id,
      player_id: user.id,
      predicted_home: predictions[game.id].home,
      predicted_away: predictions[game.id].away,
      submitted_at: new Date().toISOString()
    }));

    const { error } = await supabase()
      .from("predictions")
      .insert(rows);

    if (error) {
      setMessage("Could not submit picks: " + error.message);
      return;
    }

    setMessage("Your 7 picks have been submitted and locked.");
  }

  return (
    <main className="wrap">

      <div className="card">

        <div className="muted">
          {round ? `ROUND ${round.round_number} • OPEN` : "PICK 7"}
        </div>

        <h2>
          {round ? "Make Your 7 Picks" : "Pick 7"}
        </h2>

        {loading && (
          <p className="muted">
            Loading the 7 selected fixtures...
          </p>
        )}

        {!loading && round && games.length === 7 && (
          <>
            <p className="muted">
              Predict the exact score for every match.
            </p>

            {games.map((game, index) => (
              <div className="fixture" key={game.id}>

                <div className="team">
                  {index + 1}. {game.home_team}
                </div>

                <input
                  className="score"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={predictions[game.id]?.home ?? ""}
                  onChange={e =>
                    setScore(game.id, "home", e.target.value)
                  }
                />

                <div>-</div>

                <input
                  className="score"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={predictions[game.id]?.away ?? ""}
                  onChange={e =>
                    setScore(game.id, "away", e.target.value)
                  }
                />

                <div className="away">
                  {game.away_team}
                </div>

              </div>
            ))}

            <br />

            <button
              className="btn"
              onClick={submit}
              disabled={!user}
            >
              SUBMIT & LOCK MY PICKS
            </button>

            {!user && (
              <p className="muted">
                Please create an account or sign in below before submitting.
              </p>
            )}
          </>
        )}

        {!loading && !round && (
          <p className="muted">{message}</p>
        )}

        {!loading && round && games.length !== 7 && (
          <p className="notice">{message}</p>
        )}

      </div>

      <div className="card">

        <h3>Player Sign-in</h3>

        {user ? (
          <>
            <p className="muted">
              Signed in as {user.email}
            </p>

            <button className="btn" onClick={signOut}>
              SIGN OUT
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Sign in with your email and password.
            </p>

            <form onSubmit={signIn}>

              <input
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#07111f",
                  border: "1px solid #42627e",
                  borderRadius: 8
                }}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <br />
              <br />

              <input
                style={{
                  width: "100%",
                  padding: 12,
                  background: "#07111f",
                  border: "1px solid #42627e",
                  borderRadius: 8
                }}
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              <br />
              <br />

              <button className="btn" type="submit">
                SIGN IN
              </button>

            </form>

            <br />

            <button
              className="btn"
              onClick={createAccount}
            >
              CREATE PLAYER ACCOUNT
            </button>
          </>
        )}

        <p className="notice">
          {message}
        </p>

      </div>

    </main>
  );
}
