"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [round, setRound] = useState(null);
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [players, setPlayers] = useState([]);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [locked, setLocked] = useState(false);

  const [lockTime, setLockTime] = useState(null);
  const [countdown, setCountdown] = useState("");

  const [message, setMessage] = useState("");

  const [changePasswordOpen, setChangePasswordOpen] =
    useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [changingPassword, setChangingPassword] =
    useState(false);

  const scoreRefs = useRef([]);

  /*
   --------------------------------------------------
   LOAD CURRENT ROUND
   --------------------------------------------------
  */

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    setLoading(true);
    setMessage("");

    try {
      const db = supabase();

      const {
        data: { session },
      } = await db.auth.getSession();

      const currentUser = session?.user || null;

      if (currentUser) {
        setUser(currentUser);
        loadProfile(currentUser.id);
      }

      loadPlayers();

      const {
        data: currentRound,
        error: roundError,
      } = await db
        .from("rounds")
        .select(
          "id, round_number, status, matchday, predictions_deadline"
        )
        .eq("status", "open")
        .order("round_number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (roundError) {
        throw roundError;
      }

      if (!currentRound) {
        setRound(null);
        setGames([]);
        setMessage("No round is currently open.");
        setLoading(false);
        return;
      }

      setRound(currentRound);

      const {
        data: links,
        error: linksError,
      } = await db
        .from("round_fixtures")
        .select("fixture_number, fixture_id")
        .eq("round_id", currentRound.id)
        .order("fixture_number", {
          ascending: true,
        });

      if (linksError) {
        throw linksError;
      }

      const fixtureIds = (links || [])
        .map((item) => item.fixture_id)
        .filter(Boolean);

      if (fixtureIds.length === 0) {
        throw new Error(
          "No fixtures have been selected for this round."
        );
      }

      const {
        data: fixtureData,
        error: fixtureError,
      } = await db
        .from("fixtures")
        .select(
          "id, home_team, away_team, kickoff, home_score, away_score, result_entered"
        )
        .in("id", fixtureIds);

      if (fixtureError) {
        throw fixtureError;
      }

      const fixtureMap = Object.fromEntries(
        (fixtureData || []).map((fixture) => [
          fixture.id,
          fixture,
        ])
      );

      const orderedGames = (links || [])
        .map((link) => fixtureMap[link.fixture_id])
        .filter(Boolean);

      if (orderedGames.length === 0) {
        throw new Error(
          "The selected fixtures could not be loaded."
        );
      }

      setGames(orderedGames);

      /*
       --------------------------------------------------
       USE DATABASE ROUND DEADLINE
       --------------------------------------------------
       
       The database deadline is set to one hour before
       the earliest Premier League fixture in the
       Matchweek, whether or not that fixture is one
       of the seven Pick 7 games.
      */

      const deadline = currentRound.predictions_deadline;

      if (deadline) {
        const deadlineTime =
          new Date(deadline).getTime();

        setLockTime(deadline);
        setLocked(deadlineTime <= Date.now());
      } else {
        /*
         Fallback only if the database deadline is
         missing. In that case use one hour before
         the earliest selected Pick 7 game.
        */

        const earliestKickoff = Math.min(
          ...orderedGames.map((game) =>
            new Date(game.kickoff).getTime()
          )
        );

        const fallbackDeadline = new Date(
          earliestKickoff - 60 * 60 * 1000
        ).toISOString();

        setLockTime(fallbackDeadline);

        setLocked(
          new Date(fallbackDeadline).getTime() <=
            Date.now()
        );
      }

      /*
       --------------------------------------------------
       LOAD EXISTING PICKS
       --------------------------------------------------
      */

      if (currentUser) {
        await loadExistingPicks(
          currentUser.id,
          currentRound.id,
          orderedGames
        );
      }
    } catch (error) {
      console.error(
        "Pick 7 loading error:",
        error
      );

      setMessage(
        "Unable to load Pick 7: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   --------------------------------------------------
   REFRESH LIVE RESULTS
   --------------------------------------------------
  */

  useEffect(() => {
    if (!round || games.length === 0) {
      return;
    }

    async function refreshResults() {
      try {
        const db = supabase();

        const fixtureIds = games
          .map((game) => game.id)
          .filter(Boolean);

        if (fixtureIds.length === 0) {
          return;
        }

        const {
          data,
          error,
        } = await db
          .from("fixtures")
          .select(
            "id, home_team, away_team, kickoff, home_score, away_score, result_entered"
          )
          .in("id", fixtureIds);

        if (error) {
          console.error(
            "Live result refresh error:",
            error
          );
          return;
        }

        if (!data) {
          return;
        }

        const updatedMap = Object.fromEntries(
          data.map((fixture) => [
            fixture.id,
            fixture,
          ])
        );

        setGames((currentGames) =>
          currentGames.map((game) => ({
            ...game,
            ...(updatedMap[game.id] || {}),
          }))
        );
      } catch (error) {
        console.error(
          "Live result refresh error:",
          error
        );
      }
    }

    refreshResults();

    const interval = setInterval(
      refreshResults,
      30000
    );

    return () => {
      clearInterval(interval);
    };
  }, [round?.id, games.length]);

  /*
   --------------------------------------------------
   CALCULATE GAME POINTS
   --------------------------------------------------
  */

  function getGamePoints(
    prediction,
    fixture
  ) {
    if (
      !fixture?.result_entered ||
      fixture.home_score === null ||
      fixture.away_score === null ||
      fixture.home_score === undefined ||
      fixture.away_score === undefined
    ) {
      return null;
    }

    if (
      Number(prediction.home) ===
        Number(fixture.home_score) &&
      Number(prediction.away) ===
        Number(fixture.away_score)
    ) {
      return 10;
    }

    const predictedResult =
      Number(prediction.home) >
      Number(prediction.away)
        ? "H"
        : Number(prediction.home) <
            Number(prediction.away)
          ? "A"
          : "D";

    const actualResult =
      Number(fixture.home_score) >
      Number(fixture.away_score)
        ? "H"
        : Number(fixture.home_score) <
            Number(fixture.away_score)
          ? "A"
          : "D";

    if (
      predictedResult === actualResult
    ) {
      return 6;
    }

    return 0;
  }

  /*
   --------------------------------------------------
   CALCULATE RUNNING TOTAL
   --------------------------------------------------
  */

  function getRunningTotal() {
    if (!user || !submitted) {
      return null;
    }

    let total = 0;
    let completedGames = 0;

    games.forEach((game) => {
      const prediction =
        predictions[game.id];

      if (!prediction) {
        return;
      }

      const points = getGamePoints(
        prediction,
        game
      );

      if (points !== null) {
        total += points;
        completedGames++;
      }
    });

    return {
      total,
      completedGames,
    };
  }

  /*
   --------------------------------------------------
   LOAD PROFILE
   --------------------------------------------------
  */

  async function loadProfile(userId) {
    try {
      const { data } = await supabase()
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();

      setIsAdmin(Boolean(data?.is_admin));
    } catch (error) {
      console.error(
        "Profile loading error:",
        error
      );
    }
  }

  /*
   --------------------------------------------------
   LOAD PLAYER NAMES
   --------------------------------------------------
  */

  async function loadPlayers() {
    try {
      const { data, error } =
        await supabase().functions.invoke(
          "player-login",
          {
            body: {
              action: "list",
            },
          }
        );

      if (error) {
        console.error(
          "Player list error:",
          error
        );
        return;
      }

      setPlayers(data?.players || []);
    } catch (error) {
      console.error(
        "Player list error:",
        error
      );
    }
  }

  /*
   --------------------------------------------------
   EXISTING PICKS
   --------------------------------------------------
  */

  async function loadExistingPicks(
    userId,
    roundId,
    currentGames
  ) {
    try {
      const {
        data,
        error,
      } = await supabase()
        .from("predictions")
        .select(
          "fixture_id, predicted_home, predicted_away"
        )
        .eq("round_id", roundId)
        .eq("player_id", userId);

      if (error) {
        console.error(
          "Existing picks error:",
          error
        );
        return;
      }

      if (!data || data.length === 0) {
        return;
      }

      const saved = {};

      data.forEach((prediction) => {
        saved[prediction.fixture_id] = {
          home: prediction.predicted_home,
          away: prediction.predicted_away,
        };
      });

      setPredictions(saved);

      if (
        data.length === currentGames.length
      ) {
        setSubmitted(true);
        setMessage(
          "Your picks are already submitted and locked."
        );
      }
    } catch (error) {
      console.error(
        "Existing picks error:",
        error
      );
    }
  }

  /*
   --------------------------------------------------
   COUNTDOWN
   --------------------------------------------------
  */

  useEffect(() => {
    if (!lockTime) {
      return;
    }

    function updateCountdown() {
      const difference =
        new Date(lockTime).getTime() -
        Date.now();

      if (difference <= 0) {
        setLocked(true);
        setCountdown("PICKS LOCKED");
        return;
      }

      const totalSeconds = Math.floor(
        difference / 1000
      );

      const days = Math.floor(
        totalSeconds / 86400
      );

      const hours = Math.floor(
        (totalSeconds % 86400) / 3600
      );

      const minutes = Math.floor(
        (totalSeconds % 3600) / 60
      );

      const seconds =
        totalSeconds % 60;

      if (days > 0) {
        setCountdown(
          `${days}d ${String(hours).padStart(
            2,
            "0"
          )}h ${String(minutes).padStart(
            2,
            "0"
          )}m`
        );
      } else {
        setCountdown(
          `${String(hours).padStart(
            2,
            "0"
          )}:${String(minutes).padStart(
            2,
            "0"
          )}:${String(seconds).padStart(
            2,
            "0"
          )}`
        );
      }

      setLocked(false);
    }

    updateCountdown();

    const timer = setInterval(
      updateCountdown,
      1000
    );

    return () => {
      clearInterval(timer);
    };
  }, [lockTime]);

  /*
   --------------------------------------------------
   SIGN IN
   --------------------------------------------------
  */

  async function signIn(event) {
    event.preventDefault();

    if (signingIn) {
      return;
    }

    if (!playerName) {
      setMessage(
        "Please select your player name."
      );
      return;
    }

    if (!password) {
      setMessage(
        "Please enter your password."
      );
      return;
    }

    setSigningIn(true);
    setMessage("Signing in...");

    try {
      const { data, error } =
        await supabase().functions.invoke(
          "player-login",
          {
            body: {
              display_name: playerName,
              password,
            },
          }
        );

      if (error) {
        throw error;
      }

      if (
        !data?.access_token ||
        !data?.refresh_token
      ) {
        throw new Error(
          "Invalid login response."
        );
      }

      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase().auth.setSession({
          access_token:
            data.access_token,
          refresh_token:
            data.refresh_token,
        });

      if (sessionError) {
        throw sessionError;
      }

      const loggedInUser =
        sessionData?.user;

      if (!loggedInUser) {
        throw new Error(
          "Login succeeded but no user session was returned."
        );
      }

      setUser(loggedInUser);
      setPassword("");

      await loadProfile(
        loggedInUser.id
      );

      if (
        round &&
        games.length > 0
      ) {
        await loadExistingPicks(
          loggedInUser.id,
          round.id,
          games
        );
      }

      setMessage(
        "You are signed in."
      );
    } catch (error) {
      console.error(
        "Sign-in error:",
        error
      );

      setMessage(
        "Sign-in failed: " +
          (error?.message ||
            "Incorrect player name or password.")
      );
    } finally {
      setSigningIn(false);
    }
  }

  /*
   --------------------------------------------------
   SCORE ENTRY
   --------------------------------------------------
  */

  function updateScore(
    fixtureId,
    side,
    value,
    index
  ) {
    if (
      !user ||
      submitted ||
      locked
    ) {
      return;
    }

    setPredictions((current) => ({
      ...current,
      [fixtureId]: {
        ...(current[fixtureId] || {}),
        [side]:
          value === ""
            ? ""
            : Number(value),
      },
    }));

    if (value !== "") {
      const next =
        scoreRefs.current[index + 1];

      if (next) {
        next.focus();

        try {
          next.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch {}
      }
    }
  }

  /*
   --------------------------------------------------
   SUBMIT PICKS
   --------------------------------------------------
  */

  async function submitPicks() {
    if (
      submitting ||
      submitted ||
      locked
    ) {
      return;
    }

    if (!user) {
      setMessage(
        "Please sign in before submitting your picks."
      );
      return;
    }

    if (
      !round ||
      games.length === 0
    ) {
      setMessage(
        "There are no games available."
      );
      return;
    }

    const incomplete = games.some(
      (game) => {
        const prediction =
          predictions[game.id];

        return (
          prediction?.home === undefined ||
          prediction?.home === "" ||
          prediction?.away === undefined ||
          prediction?.away === ""
        );
      }
    );

    if (incomplete) {
      setMessage(
        `Please enter all ${games.length} scores.`
      );
      return;
    }

    setSubmitting(true);
    setMessage(
      "Submitting your picks..."
    );

    try {
      const rows = games.map(
        (game) => ({
          round_id: round.id,
          fixture_id: game.id,
          player_id: user.id,
          predicted_home:
            predictions[game.id].home,
          predicted_away:
            predictions[game.id].away,
          submitted_at:
            new Date().toISOString(),
        })
      );

      const {
        error,
      } = await supabase()
        .from("predictions")
        .insert(rows);

      if (error) {
        if (
          error.code === "23505"
        ) {
          setSubmitted(true);
          setMessage(
            "Your picks are already submitted and locked."
          );
        } else {
          throw error;
        }

        return;
      }

      setSubmitted(true);

      setMessage(
        "✅ Your picks have been submitted and locked."
      );
    } catch (error) {
      console.error(
        "Submit error:",
        error
      );

      setMessage(
        "Could not submit picks: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   --------------------------------------------------
   SIGN OUT
   --------------------------------------------------
  */

  async function signOut() {
    setUser(null);
    setIsAdmin(false);
    setSubmitted(false);
    setPredictions({});
    setPlayerName("");
    setPassword("");
    setChangePasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");

    setMessage(
      "You have been signed out."
    );

    try {
      await supabase().auth.signOut({
        scope: "local",
      });
    } catch (error) {
      console.error(
        "Sign-out error:",
        error
      );
    }
  }

  /*
   --------------------------------------------------
   CHANGE PASSWORD
   --------------------------------------------------
  */

  async function changePassword() {
    if (changingPassword) {
      return;
    }

    if (!newPassword) {
      setMessage(
        "Please enter a new passcode."
      );
      return;
    }

    if (newPassword.length < 6) {
      setMessage(
        "Your new passcode must be at least 6 characters."
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setMessage(
        "The new passcodes do not match."
      );
      return;
    }

    setChangingPassword(true);
    setMessage(
      "Changing your passcode..."
    );

    try {
      const { error } =
        await supabase().auth.updateUser({
          password: newPassword,
        });

      if (error) {
        throw error;
      }

      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);

      setMessage(
        "✅ Your passcode has been changed successfully."
      );
    } catch (error) {
      console.error(
        "Password change error:",
        error
      );

      setMessage(
        "Could not change passcode: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setChangingPassword(false);
    }
  }

  /*
   --------------------------------------------------
   FORMAT KICKOFF
   --------------------------------------------------
  */

  function formatKickoff(kickoff) {
    return new Date(
      kickoff
    ).toLocaleString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  /*
   --------------------------------------------------
   RUNNING TOTAL
   --------------------------------------------------
  */

  const runningTotal =
    getRunningTotal();

  /*
   --------------------------------------------------
   RENDER
   --------------------------------------------------
  */

  return (
    <main className="wrap">

      <section className="card hero">

        <div className="pill">
          {round
            ? `ROUND ${((round.round_number - 1) % 5) + 1} OF 5 • ${
                locked
                  ? "LOCKED"
                  : "OPEN"
              }`
            : "PICK 7"}
        </div>

        {round && (
          <div
            className="muted"
            style={{
              marginTop: "10px",
              fontWeight: "800",
              letterSpacing: "0.5px"
            }}
          >
            COMPETITION 2 • NEW 5-ROUND SERIES
          </div>
        )}

        <h2>
          {round
            ? `Make Your ${
                games.length || 7
              } Picks`
            : "Pick 7"}
        </h2>

        <p className="muted">
          Predict the exact score for every
          selected match.
        </p>

      </section>

      {loading && (
        <section className="card">
          <p className="muted">
            Loading this week's games...
          </p>
        </section>
      )}

      {!loading && !round && (
        <section className="card">
          <div className="notice">
            {message ||
              "No round is currently open."}
          </div>
        </section>
      )}

      {!loading &&
        round &&
        games.length > 0 && (
          <>

            {!locked &&
              lockTime && (
                <section className="card">
                  <div className="muted">
                    🔒 PICKS CLOSE IN
                  </div>

                  <h2>
                    {countdown}
                  </h2>
                </section>
              )}

            {locked && (
              <section className="card">
                <div className="notice">
                  🔒 PICKS ARE NOW LOCKED
                </div>
              </section>
            )}

            {!user && (
              <section className="card">

                <h3>
                  🔐 SIGN IN TO PLAY
                </h3>

                <p className="muted">
                  Select your name and enter
                  your passcode.
                </p>

                <form
                  onSubmit={signIn}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >

                  <select
                    className="input"
                    value={playerName}
                    onChange={(event) =>
                      setPlayerName(
                        event.target.value
                      )
                    }
                  >

                    <option value="">
                      Select your player name
                    </option>

                    {players.map(
                      (player) => (
                        <option
                          key={player}
                          value={player}
                        >
                          {player}
                        </option>
                      )
                    )}

                  </select>

                  <input
                    className="input"
                    type="password"
                    placeholder="Passcode"
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    autoComplete="current-password"
                  />

                  <button
                    className="btn"
                    type="submit"
                    disabled={signingIn}
                  >
                    {signingIn
                      ? "SIGNING IN..."
                      : "SIGN IN"}
                  </button>

                </form>

              </section>
            )}

            {user &&
              submitted &&
              runningTotal &&
              runningTotal.completedGames >
                0 && (
                <section className="card">

                  <div className="muted">
                    YOUR CURRENT SCORE
                  </div>

                  <h2>
                    {runningTotal.total} POINTS
                  </h2>

                  <p className="muted">
                    {runningTotal.completedGames} of{" "}
                    {games.length} games completed
                  </p>

                </section>
              )}

            <section className="card">

              <p className="muted">
                {user
                  ? "Enter your predicted scores."
                  : "🔒 Sign in above to enter your scores."}
              </p>

              {games.map(
                (game, index) => {

                  const prediction =
                    predictions[
                      game.id
                    ] || {};

                  const gamePoints =
                    user &&
                    submitted
                      ? getGamePoints(
                          prediction,
                          game
                        )
                      : null;

                  const homeIndex =
                    index * 2;

                  const awayIndex =
                    index * 2 + 1;

                  return (
                    <div
                      className="fixture"
                      key={game.id}
                    >

                      <div className="fixtureNumber">
                        GAME {index + 1}
                      </div>

                      <div className="kickoff">
                        {formatKickoff(
                          game.kickoff
                        )}
                      </div>

                      <div className="teams">

                        <div className="team">

                          <strong>
                            {game.home_team}
                          </strong>

                          {!game.result_entered ? (
                            <input
                              ref={(element) => {
                                scoreRefs.current[
                                  homeIndex
                                ] = element;
                              }}
                              type="number"
                              min="0"
                              max="20"
                              inputMode="numeric"
                              value={
                                prediction.home ===
                                undefined
                                  ? ""
                                  : prediction.home
                              }
                              disabled={
                                !user ||
                                submitted ||
                                locked
                              }
                              onChange={(event) =>
                                updateScore(
                                  game.id,
                                  "home",
                                  event.target.value,
                                  homeIndex
                                )
                              }
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: "900",
                                marginTop: "8px"
                              }}
                            >
                              {prediction.home}
                            </div>
                          )}

                        </div>

                        <div className="vs">
                          VS
                        </div>

                        <div className="team">

                          {!game.result_entered ? (
                            <input
                              ref={(element) => {
                                scoreRefs.current[
                                  awayIndex
                                ] = element;
                              }}
                              type="number"
                              min="0"
                              max="20"
                              inputMode="numeric"
                              value={
                                prediction.away ===
                                undefined
                                  ? ""
                                  : prediction.away
                              }
                              disabled={
                                !user ||
                                submitted ||
                                locked
                              }
                              onChange={(event) =>
                                updateScore(
                                  game.id,
                                  "away",
                                  event.target.value,
                                  awayIndex
                                )
                              }
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: "900",
                                marginTop: "8px"
                              }}
                            >
                              {prediction.away}
                            </div>
                          )}

                          <strong>
                            {game.away_team}
                          </strong>

                        </div>

                      </div>

                      {game.result_entered &&
                        game.home_score !== null &&
                        game.away_score !== null && (
                          <div
                            style={{
                              marginTop: "14px",
                              paddingTop: "12px",
                              borderTop:
                                "1px solid rgba(255,255,255,0.08)",
                              textAlign: "center"
                            }}
                          >

                            <div className="muted">
                              ACTUAL RESULT
                            </div>

                            <div
                              style={{
                                fontSize: "22px",
                                fontWeight: "900",
                                marginTop: "4px"
                              }}
                            >
                              {game.home_score}
                              {" - "}
                              {game.away_score}
                            </div>

                            {gamePoints !==
                              null && (
                              <div
                                style={{
                                  marginTop: "8px",
                                  fontSize: "17px",
                                  fontWeight: "900"
                                }}
                              >
                                {gamePoints} POINTS
                              </div>
                            )}

                          </div>
                        )}

                    </div>
                  );
                }
              )}

            </section>

            {message && (
              <section className="card">
                <div className="notice">
                  {message}
                </div>
              </section>
            )}

            {user && (
              <section className="card">

                <p className="muted">
                  👤 Signed in
                </p>

                {!submitted &&
                  !locked && (
                    <button
                      className="btn"
                      type="button"
                      onClick={submitPicks}
                      disabled={submitting}
                    >
                      {submitting
                        ? "SUBMITTING..."
                        : `SUBMIT ${games.length} PICKS`}
                    </button>
                  )}

                {submitted && (
                  <div className="notice">
                    ✅ Your picks are locked in.
                  </div>
                )}

                <div className="account-actions">

                  <button
                    type="button"
                    onClick={() =>
                      setChangePasswordOpen(
                        (value) => !value
                      )
                    }
                  >
                    🔐 CHANGE PASSCODE
                  </button>

                  <button
                    type="button"
                    className="sign-out"
                    onClick={signOut}
                  >
                    ⇥ SIGN OUT
                  </button>

                </div>

                {changePasswordOpen && (
                  <div
                    className="card"
                    style={{
                      marginTop: "14px",
                    }}
                  >

                    <h3>
                      Change Passcode
                    </h3>

                    <div
                      style={{
                        display: "flex",
                        flexDirection:
                          "column",
                        gap: "10px",
                      }}
                    >

                      <input
                        className="input"
                        type="password"
                        placeholder="New passcode"
                        value={
                          newPassword
                        }
                        onChange={(event) =>
                          setNewPassword(
                            event.target.value
                          )
                        }
                        autoComplete="new-password"
                      />

                      <input
                        className="input"
                        type="password"
                        placeholder="Confirm new passcode"
                        value={
                          confirmPassword
                        }
                        onChange={(event) =>
                          setConfirmPassword(
                            event.target.value
                          )
                        }
                        autoComplete="new-password"
                      />

                      <button
                        className="btn"
                        type="button"
                        onClick={
                          changePassword
                        }
                        disabled={
                          changingPassword
                        }
                      >
                        {changingPassword
                          ? "CHANGING..."
                          : "CHANGE PASSCODE"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setChangePasswordOpen(
                            false
                          );
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        CANCEL
                      </button>

                    </div>

                  </div>
                )}

                {isAdmin && (
                  <a
                    href="/admin"
                    className="btn"
                    style={{
                      display: "block",
                      textAlign: "center",
                      textDecoration:
                        "none",
                      marginTop: "12px",
                    }}
                  >
                    ⚙️ ADMIN
                  </a>
                )}

              </section>
            )}

          </>
        )}

    </main>
  );
}
