"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [competitions, setCompetitions] = useState([]);
  const [rounds, setRounds] = useState([]);

  const [selectedCompetition, setSelectedCompetition] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [selectedRound, setSelectedRound] = useState("");

  const [resultGames, setResultGames] = useState([]);
  const [results, setResults] = useState({});

  const [message, setMessage] = useState("Checking admin access...");
  const [loadingResults, setLoadingResults] = useState(false);
  const [savingResult, setSavingResult] = useState(null);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase().auth.getUser();

    if (!user) {
      setMessage("Please sign in as the Pick 7 administrator.");
      return;
    }

    const { data: profile, error } = await supabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (error || !profile?.is_admin) {
      await supabase().auth.signOut();
      setMessage("This account is not authorised as a Pick 7 administrator.");
      return;
    }

    setUser(user);
    loadData();
  }

  async function login() {
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }

    setMessage("Signing in...");

    const { data, error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage("Sign-in failed: " + error.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      await supabase().auth.signOut();
      setUser(null);
      setMessage("This account is not authorised as a Pick 7 administrator.");
      return;
    }

    setUser(data.user);
    setPassword("");
    setMessage("");
    loadData();
  }

  async function logout() {
    await supabase().auth.signOut();
    setUser(null);
    setMessage("Signed out.");
  }

  async function loadData() {
    setMessage("Loading...");

    const { data: comps, error: compError } = await supabase()
      .from("competitions")
      .select("*")
      .order("created_at", { ascending: false });

    if (compError) {
      setMessage("Database error: " + compError.message);
      return;
    }

    const { data: roundData, error: roundError } = await supabase()
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    if (roundError) {
      setMessage("Database error: " + roundError.message);
      return;
    }

    setCompetitions(comps || []);
    setRounds(roundData || []);

    if (!selectedCompetition && comps?.length) {
      setSelectedCompetition(comps[0].id);
    }

    if (!selectedRound && roundData?.length) {
      setSelectedRound(roundData[0].id);
    }

    setMessage("");
  }

  async function createCompetition() {
    if (!competitionName.trim()) {
      setMessage("Enter a competition name.");
      return;
    }

    setMessage("Creating competition...");

    const { data, error } = await supabase()
      .from("competitions")
      .insert({
        name: competitionName.trim(),
        rounds_total: 5,
      })
      .select()
      .single();

    if (error) {
      setMessage("Could not create competition: " + error.message);
      return;
    }

    setCompetitionName("");
    setSelectedCompetition(data.id);
    setMessage("Competition created successfully.");
    loadData();
  }

  async function createRound() {
    if (!selectedCompetition) {
      setMessage("Select a competition first.");
      return;
    }

    setMessage("Creating round...");

    const { error } = await supabase().rpc("create_pick7_round", {
      p_competition_id: selectedCompetition,
    });

    if (error) {
      setMessage("Could not create round: " + error.message);
      return;
    }

    setMessage("Round created successfully.");
    loadData();
  }

  async function loadResults(roundId) {
    if (!roundId) {
      setResultGames([]);
      return;
    }

    setLoadingResults(true);
    setMessage("Loading round fixtures...");

    const { data: links, error: linkError } = await supabase()
      .from("round_fixtures")
      .select("fixture_number,fixture_id")
      .eq("round_id", roundId)
      .order("fixture_number", { ascending: true });

    if (linkError) {
      setMessage("Could not load round fixtures: " + linkError.message);
      setLoadingResults(false);
      return;
    }

    const fixtureIds = (links || []).map(x => x.fixture_id);

    if (fixtureIds.length !== 7) {
      setMessage(
        `This round contains ${fixtureIds.length} fixtures instead of 7.`
      );
      setResultGames([]);
      setLoadingResults(false);
      return;
    }

    const { data: fixtures, error: fixtureError } = await supabase()
      .from("fixtures")
      .select(
        "id,home_team,away_team,kickoff,home_score,away_score,result_entered"
      )
      .in("id", fixtureIds);

    if (fixtureError) {
      setMessage("Could not load results: " + fixtureError.message);
      setLoadingResults(false);
      return;
    }

    const byId = Object.fromEntries(
      (fixtures || []).map(f => [f.id, f])
    );

    const ordered = (links || [])
      .map(link => byId[link.fixture_id])
      .filter(Boolean);

    const initialResults = {};

    ordered.forEach(game => {
      initialResults[game.id] = {
        home:
          game.home_score === null ||
          game.home_score === undefined
            ? ""
            : game.home_score,
        away:
          game.away_score === null ||
          game.away_score === undefined
            ? ""
            : game.away_score,
      };
    });

    setResultGames(ordered);
    setResults(initialResults);
    setLoadingResults(false);
    setMessage("");
  }

  useEffect(() => {
    if (selectedRound) {
      loadResults(selectedRound);
    }
  }, [selectedRound]);

  function setResult(id, side, value) {
    setResults(current => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        [side]: value === "" ? "" : Number(value),
      },
    }));
  }

  async function saveResult(game) {
    const result = results[game.id];

    if (
      result?.home === "" ||
      result?.home === undefined ||
      result?.away === "" ||
      result?.away === undefined
    ) {
      setMessage("Enter both scores before saving the result.");
      return;
    }

    setSavingResult(game.id);
    setMessage("Saving result...");

    const { error } = await supabase()
      .from("fixtures")
      .update({
        home_score: Number(result.home),
        away_score: Number(result.away),
        result_entered: true,
      })
      .eq("id", game.id);

    if (error) {
      setMessage("Could not save result: " + error.message);
      setSavingResult(null);
      return;
    }

    setMessage(`${game.home_team} ${result.home}-${result.away} ${game.away_team} saved.`);
    setSavingResult(null);

    loadResults(selectedRound);
  }

  async function scoreRound() {
    if (!selectedRound) {
      setMessage("Select a round first.");
      return;
    }

    const incomplete = resultGames.some(game => {
      const result = results[game.id];

      return (
        result?.home === "" ||
        result?.home === undefined ||
        result?.away === "" ||
        result?.away === undefined
      );
    });

    if (incomplete) {
      setMessage("Enter and save all 7 results before scoring the round.");
      return;
    }

    setScoring(true);
    setMessage("Scoring round...");

    for (const game of resultGames) {
      const result = results[game.id];

      const { error } = await supabase()
        .from("fixtures")
        .update({
          home_score: Number(result.home),
          away_score: Number(result.away),
          result_entered: true,
        })
        .eq("id", game.id);

      if (error) {
        setMessage("Could not save a result: " + error.message);
        setScoring(false);
        return;
      }
    }

    const { error: scoreError } = await supabase().rpc(
      "score_pick7_round",
      {
        p_round_id: selectedRound,
      }
    );

    if (scoreError) {
      setMessage("Could not score round: " + scoreError.message);
      setScoring(false);
      return;
    }

    const { error: closeError } = await supabase()
      .from("rounds")
      .update({
        status: "completed",
      })
      .eq("id", selectedRound);

    if (closeError) {
      setMessage(
        "Round scored, but could not mark it completed: " +
        closeError.message
      );
      setScoring(false);
      return;
    }

    setMessage(
      "Round scored successfully. Match points and competition points have been calculated."
    );

    setScoring(false);
    loadData();
    loadResults(selectedRound);
  }

  if (!user) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">PICK 7 ADMIN</div>
          <h2>Administrator Sign-in</h2>

          <p>Sign in with your Pick 7 administrator account.</p>

          <input
            type="email"
            placeholder="Admin email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
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

          <input
            type="password"
            placeholder="Admin password"
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

          <button className="btn" onClick={login}>
            SIGN IN
          </button>

          {message && (
            <div className="notice" style={{ marginTop: 20 }}>
              {message}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>

        <h2>Admin Dashboard</h2>

        <p>Signed in as administrator.</p>

        <button className="btn" onClick={logout}>
          SIGN OUT
        </button>
      </div>

      <div className="card">
        <h3>1. Create Competition</h3>

        <input
          type="text"
          placeholder="Competition name"
          value={competitionName}
          onChange={e => setCompetitionName(e.target.value)}
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

        <button className="btn" onClick={createCompetition}>
          CREATE 5-ROUND COMPETITION
        </button>
      </div>

      <div className="card">
        <h3>2. Select Competition</h3>

        {competitions.length === 0 ? (
          <p className="muted">No competitions created yet.</p>
        ) : (
          <select
            value={selectedCompetition}
            onChange={e => setSelectedCompetition(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              background: "#07111f",
              color: "white",
              border: "1px solid #42627e",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {competitions.map(competition => (
              <option
                key={competition.id}
                value={competition.id}
              >
                {competition.name}
              </option>
            ))}
          </select>
        )}

        <button
          className="btn"
          onClick={createRound}
          disabled={!selectedCompetition}
        >
          CREATE NEXT ROUND
        </button>
      </div>

      <div className="card">
        <h3>3. Results & Scoring</h3>

        {rounds.length === 0 ? (
          <p className="muted">
            Create a round first.
          </p>
        ) : (
          <>
            <select
              value={selectedRound}
              onChange={e => setSelectedRound(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                background: "#07111f",
                color: "white",
                border: "1px solid #42627e",
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              {rounds.map(round => (
                <option
                  key={round.id}
                  value={round.id}
                >
                  Round {round.round_number} — {round.status}
                </option>
              ))}
            </select>

            {loadingResults ? (
              <p className="muted">
                Loading fixtures...
              </p>
            ) : (
              <>
                {resultGames.map((game, index) => (
                  <div
                    key={game.id}
                    style={{
                      padding: 14,
                      marginBottom: 12,
                      border: "1px solid #42627e",
                      borderRadius: 10,
                    }}
                  >
                    <strong>
                      {index + 1}. {game.home_team}
                    </strong>

                    <div className="muted">
                      vs {game.away_team}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 60px 20px 60px",
                        gap: 8,
                        alignItems: "center",
                        marginTop: 12,
                      }}
                    >
                      <span>Home</span>

                      <input
                        className="score"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={results[game.id]?.home ?? ""}
                        onChange={e =>
                          setResult(
                            game.id,
                            "home",
                            e.target.value
                          )
                        }
                      />

                      <span>-</span>

                      <input
                        className="score"
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={results[game.id]?.away ?? ""}
                        onChange={e =>
                          setResult(
                            game.id,
                            "away",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <br />

                    <button
                      className="btn"
                      onClick={() => saveResult(game)}
                      disabled={savingResult === game.id}
                    >
                      {savingResult === game.id
                        ? "SAVING..."
                        : game.result_entered
                        ? "UPDATE RESULT"
                        : "SAVE RESULT"}
                    </button>
                  </div>
                ))}

                {resultGames.length === 7 && (
                  <button
                    className="btn"
                    onClick={scoreRound}
                    disabled={
                      scoring ||
                      rounds.find(r => r.id === selectedRound)
                        ?.status === "completed"
                    }
                  >
                    {scoring
                      ? "SCORING ROUND..."
                      : rounds.find(r => r.id === selectedRound)
                          ?.status === "completed"
                      ? "ROUND ALREADY SCORED"
                      : "🏆 SCORE ROUND"}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {message && (
          <div className="notice" style={{ marginTop: 20 }}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Existing Rounds</h3>

        {rounds.length === 0 ? (
          <p className="muted">
            No rounds have been created yet.
          </p>
        ) : (
          rounds.map(round => (
            <div
              key={round.id}
              style={{
                padding: 14,
                marginBottom: 10,
                border: "1px solid #42627e",
                borderRadius: 8,
              }}
            >
              <strong>
                Round {round.round_number}
              </strong>

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
