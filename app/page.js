"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
  const [round, setRound] = useState(null);
  const [games, setGames] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading Pick 7...");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockTime, setLockTime] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [alerts, setAlerts] = useState([]);

  const [changePasswordOpen, setChangePasswordOpen] =
    useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [changingPassword, setChangingPassword] =
    useState(false);

  const scoreRefs = useRef([]);

  /* -------------------------------------------------
     LOAD THE APP
     ------------------------------------------------- */

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);

    try {
      const db = supabase();

      /*
        Get the current user and open round at the
        same time. Neither depends on the other.
      */
      const [
        {
          data: { user: currentUser },
        },
        { data: roundData, error: roundError },
      ] = await Promise.all([
        db.auth.getUser(),

        db
          .from("rounds")
          .select("id, round_number, status")
          .eq("status", "open")
          .order("round_number", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),
      ]);

      if (roundError) throw roundError;

      if (currentUser) {
        setUser(currentUser);
      }

      /*
        Load the player list separately.
        It is not allowed to hold up the games.
      */
      loadPlayers();

      if (currentUser) {
        loadUserProfile(currentUser.id);
      }

      if (!roundData) {
        setMessage("No round is currently open.");
        setLoading(false);
        return;
      }

      setRound(roundData);

      /*
        These requests are independent, so run them
        together.
      */
      const [
        { data: links, error: linksError },
        { data: alertData },
        { data: savedPredictions },
      ] = await Promise.all([
        db
          .from("round_fixtures")
          .select("fixture_number, fixture_id")
          .eq("round_id", roundData.id)
          .order("fixture_number", {
            ascending: true,
          }),

        db
          .from("fixture_change_alerts")
          .select("id, message, created_at")
          .eq("round_id", roundData.id)
          .order("created_at", {
            ascending: false,
          }),

        currentUser
          ? db
              .from("predictions")
              .select(
                "fixture_id, predicted_home, predicted_away"
              )
              .eq("round_id", roundData.id)
              .eq("player_id", currentUser.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (linksError) throw linksError;

      setAlerts(alertData || []);

      const fixtureIds = (links || [])
        .map((item) => item.fixture_id)
        .filter(Boolean);

      if (fixtureIds.length === 0) {
        throw new Error(
          "This round currently has no fixtures."
        );
      }

      /*
        Load all seven fixtures in one request.
      */
      const {
        data: fixtures,
        error: fixtureError,
      } = await db
        .from("fixtures")
        .select(
          "id, home_team, away_team, kickoff"
        )
        .in("id", fixtureIds);

      if (fixtureError) throw fixtureError;

      const byId = Object.fromEntries(
        (fixtures || []).map((fixture) => [
          fixture.id,
          fixture,
        ])
      );

      const orderedGames = (links || [])
        .map((link) => byId[link.fixture_id])
        .filter(Boolean);

      if (orderedGames.length === 0) {
        throw new Error(
          "The selected fixtures could not be loaded."
        );
      }

      /*
        Work out the earliest kickoff.
      */
      const earliestKickoff = Math.min(
        ...orderedGames.map((game) =>
          new Date(game.kickoff).getTime()
        )
      );

      setLockTime(
        new Date(
          earliestKickoff
        ).toISOString()
      );

      setLocked(
        earliestKickoff <= Date.now()
      );

      /*
        Restore saved predictions immediately.
      */
      if (
        currentUser &&
        savedPredictions &&
        savedPredictions.length === orderedGames.length
      ) {
        const saved = {};

        savedPredictions.forEach((prediction) => {
          saved[prediction.fixture_id] = {
            home: prediction.predicted_home,
            away: prediction.predicted_away,
          };
        });

        setPredictions(saved);
        setSubmitted(true);
      }

      /*
        IMPORTANT:
        Put the games on screen as soon as the essential
        data is ready.
      */
      setGames(orderedGames);
      setMessage("");
    } catch (error) {
      console.error(
        "Unable to load Pick 7:",
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

  async function loadUserProfile(userId) {
    try {
      const { data: profile } = await supabase()
        .from("profiles")
        .select("is_admin")
        .eq("id", userId)
        .maybeSingle();

      setIsAdmin(Boolean(profile?.is_admin));
    } catch (error) {
      console.error(
        "Could not load user profile:",
        error
      );
    }
  }

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
          "Could not load players:",
          error
        );
        return;
      }

      setPlayers(data?.players || []);
    } catch (error) {
      console.error(
        "Could not load players:",
        error
      );
    }
  }

  /* -------------------------------------------------
     COUNTDOWN
     ------------------------------------------------- */

  useEffect(() => {
    if (!lockTime) return;

    function updateLock() {
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

    updateLock();

    const timer = setInterval(
      updateLock,
      1000
    );

    return () =>
      clearInterval(timer);
  }, [lockTime]);

  /* -------------------------------------------------
     SIGN IN
     ------------------------------------------------- */

  async function signIn(event) {
    event.preventDefault();

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
        setMessage(
          "Sign-in failed: " +
            error.message
        );
        return;
      }

      if (
        !data?.access_token ||
        !data?.refresh_token
      ) {
        setMessage(
          "Sign-in failed: Invalid login response."
        );
        return;
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
        setMessage(
          "Sign-in failed: " +
            sessionError.message
        );
        return;
      }

      setUser(sessionData.user);

      await loadUserProfile(
        sessionData.user.id
      );

      /*
        Check for existing picks immediately
        after signing in.
      */
      if (round && games.length > 0) {
        await checkSubmitted(
          sessionData.user,
          round,
          games
        );
      }

      setPassword("");

      setMessage(
        submitted
          ? "Your picks are already submitted and locked."
          : "You are signed in."
      );

      window.dispatchEvent(
        new Event("pick7:auth-changed")
      );
    } catch (error) {
      setMessage(
        "Sign-in failed: " +
          (error?.message ||
            "Unknown error")
      );
    }
  }

  /* -------------------------------------------------
     CHECK EXISTING PICKS
     ------------------------------------------------- */

  async function checkSubmitted(
    currentUser,
    currentRound,
    currentGames
  ) {
    if (
      !currentUser ||
      !currentRound ||
      !currentGames?.length
    ) {
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase()
        .from("predictions")
        .select(
          "fixture_id, predicted_home, predicted_away"
        )
        .eq(
          "round_id",
          currentRound.id
        )
        .eq(
          "player_id",
          currentUser.id
        );

      if (error) return;

      if (
        data &&
        data.length === currentGames.length
      ) {
        const saved = {};

        data.forEach((prediction) => {
          saved[prediction.fixture_id] = {
            home:
              prediction.predicted_home,
            away:
              prediction.predicted_away,
          };
        });

        setPredictions(saved);
        setSubmitted(true);

        setMessage(
          `Your ${currentGames.length} picks are already submitted and locked.`
        );
      }
    } catch (error) {
      console.error(
        "Could not check submitted picks:",
        error
      );
    }
  }

  /* -------------------------------------------------
     SCORE ENTRY
     ------------------------------------------------- */

  function setScore(
    id,
    side,
    value,
    inputIndex
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
      [id]: {
        ...(current[id] || {}),
        [side]:
          value === ""
            ? ""
            : Number(value),
      },
    }));

    if (
      value !== "" &&
      inputIndex !== undefined
    ) {
      const nextInput =
        scoreRefs.current[
          inputIndex + 1
        ];

      if (nextInput) {
        nextInput.focus();

        try {
          nextInput.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch (error) {}
      }
    }
  }

  /* -------------------------------------------------
     SUBMIT PICKS
     ------------------------------------------------- */

  async function submit() {
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
        "There is no valid Pick 7 round available."
      );
      return;
    }

    const incomplete = games.some(
      (game) => {
        const prediction =
          predictions[game.id];

        return (
          prediction?.home ===
            undefined ||
          prediction?.away ===
            undefined ||
          prediction?.home === "" ||
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
      `Submitting your ${games.length} picks...`
    );

    try {
      const rows = games.map(
        (game) => ({
          round_id: round.id,
          fixture_id: game.id,
          player_id: user.id,
          predicted_home:
            predictions[
              game.id
            ].home,
          predicted_away:
            predictions[
              game.id
            ].away,
          submitted_at:
            new Date().toISOString(),
        })
      );

      const { error } =
        await supabase()
          .from("predictions")
          .insert(rows);

      if (error) {
        if (
          error.code ===
          "23505"
        ) {
          setSubmitted(true);

          setMessage(
            `Your ${games.length} picks are already submitted and locked.`
          );

          window.dispatchEvent(
            new Event(
              "pick7:picks-submitted"
            )
          );
        } else if (
          error.message
            ?.toLowerCase()
            .includes("locked")
        ) {
          setLocked(true);

          setMessage(
            "The first match has kicked off. Picks are now locked."
          );
        } else {
          setMessage(
            "Could not submit picks: " +
              error.message
          );
        }

        return;
      }

      setSubmitted(true);

      setMessage(
        `Your ${games.length} picks have been submitted and locked.`
      );

      /*
        Tell the navigation bar immediately that
        all seven picks have been submitted.
      */
      window.dispatchEvent(
        new Event(
          "pick7:picks-submitted"
        )
      );
    } catch (error) {
      setMessage(
        "Could not submit picks: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* -------------------------------------------------
     SIGN OUT
     ------------------------------------------------- */

  async function signOut() {
    /*
      Clear the interface immediately.
    */
    setUser(null);
    setIsAdmin(false);
    setSubmitted(false);
    setPredictions({});
    setChangePasswordOpen(false);
    setNewPassword("");
    setConfirmPassword("");
    setPassword("");
    setPlayerName("");
    setMessage(
      "You have been signed out."
    );

    window.dispatchEvent(
      new Event("pick7:auth-changed")
    );

    /*
      Finish Supabase sign-out in the
      background.
    */
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

  /* -------------------------------------------------
     CHANGE PASSWORD
     ------------------------------------------------- */

  async function changePassword() {
    if (changingPassword) return;

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
        setMessage(
          "Could not change passcode: " +
            error.message
        );
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);

      setMessage(
        "✅ Your passcode has been changed successfully."
      );
    } catch (error) {
      setMessage(
        "Could not change passcode: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setChangingPassword(false);
    }
  }

  /* -------------------------------------------------
     FORMAT KICKOFF
     ------------------------------------------------- */

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

  /* -------------------------------------------------
     DISPLAY
     ------------------------------------------------- */

  return (
    <main className="wrap">
      <div className="card">

        <div className="muted">
          {round
            ? `ROUND ${round.round_number} • ${
                locked
                  ? "LOCKED"
                  : "OPEN"
              }`
            : "PICK 7"}
        </div>

        <h2>
          {round
            ? `Make Your ${
                games.length || 7
              } Picks`
            : "Pick 7"}
        </h2>

        {alerts.length > 0 && (
          <div className="notice">
            <strong>
              ⚠️ FIXTURE UPDATE
            </strong>

            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  marginTop: "6px",
                }}
              >
                {alert.message}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <p className="muted">
            Loading the selected fixtures...
          </p>
        )}

        {!loading &&
          round &&
          games.length > 0 && (
            <>

              {!locked &&
                lockTime && (
                  <div className="notice">
                    🔒 PICKS CLOSE IN:{" "}
                    <strong>
                      {countdown}
                    </strong>
                  </div>
                )}

              {locked && (
                <div className="notice">
                  🔒 PICKS ARE NOW LOCKED
                </div>
              )}

              {games.length < 7 && (
                <div className="notice">
                  ⚠️ This round has{" "}
                  {games.length} games because
                  one or more selected fixtures
                  were postponed.
                  No replacement game will be added.
                </div>
              )}

              {!user && !locked && (
                <div
                  className="card"
                  style={{
                    marginBottom: "18px",
                  }}
                >
                  <h3>
                    🔐 SIGN IN TO PLAY
                  </h3>

                  <p className="muted">
                    Sign in first to unlock
                    the games and enter
                    your predictions.
                  </p>

                  <form
                    onSubmit={signIn}
                  >
                    <select
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
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      autoComplete="current-password"
                    />

                    <button type="submit">
                      SIGN IN
                    </button>
                  </form>
                </div>
              )}

              <div
                style={{
                  opacity:
                    user &&
                    !submitted &&
                    !locked
                      ? 1
                      : 0.65,

                  pointerEvents:
                    user &&
                    !submitted &&
                    !locked
                      ? "auto"
                      : "none",
                }}
              >
                <p className="muted">
                  {user
                    ? "Predict the exact score for every match."
                    : "🔒 Sign in above to unlock the games and enter your scores."}
                </p>

                {games.map(
                  (game, index) => {
                    const prediction =
                      predictions[
                        game.id
                      ] || {};

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
                                setScore(
                                  game.id,
                                  "home",
                                  event.target.value,
                                  homeIndex
                                )
                              }
                            />
                          </div>

                          <div className="vs">
                            V
                          </div>

                          <div className="team">
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
                                setScore(
                                  game.id,
                                  "away",
                                  event.target.value,
                                  awayIndex
                                )
                              }
                            />

                            <strong>
                              {game.away_team}
                            </strong>
                          </div>

                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {message && (
                <div className="notice">
                  {message}
                </div>
              )}

              {user && (
                <>
                  <p className="muted">
                    👤 Signed in.
                  </p>

                  {!submitted &&
                    !locked && (
                      <div className="account-actions">

                        <button
                          type="button"
                          onClick={submit}
                          disabled={
                            submitting
                          }
                        >
                          {submitting
                            ? "✈ SUBMITTING..."
                            : `✈ SUBMIT ${games.length} PICKS`}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setChangePasswordOpen(
                              (current) =>
                                !current
                            )
                          }
                        >
                          🔐 CHANGE PASSCODE
                        </button>

                        <button
                          type="button"
                          onClick={signOut}
                          className="sign-out"
                        >
                          ⇥ SIGN OUT
                        </button>

                      </div>
                    )}

                  {submitted && (
                    <>
                      <div className="notice">
                        ✅ Your picks are locked in.
                      </div>

                      <div className="account-actions">

                        <button
                          type="button"
                          onClick={() =>
                            setChangePasswordOpen(
                              (current) =>
                                !current
                            )
                          }
                        >
                          🔐 CHANGE PASSCODE
                        </button>

                        <button
                          type="button"
                          onClick={signOut}
                          className="sign-out"
                        >
                          ⇥ SIGN OUT
                        </button>

                      </div>
                    </>
                  )}

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

                      <p className="muted">
                        Choose a new passcode
                        of at least 6 characters.
                      </p>

                      <div
                        style={{
                          display: "flex",
                          flexDirection:
                            "column",
                          gap: "10px",
                        }}
                      >
                        <input
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
                          className="sign-out"
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
                </>
              )}
            </>
          )}

        {!loading && !round && (
          <div className="notice">
            {message}
          </div>
        )}

      </div>
    </main>
  );
}
