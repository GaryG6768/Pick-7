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

  useEffect(() => {
    loadRound();
    checkUser();
    loadPlayers();
  }, []);

  useEffect(() => {
    if (!lockTime) return;

    function updateLock() {
      const now = Date.now();
      const target = new Date(lockTime).getTime();
      const difference = target - now;

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

      const seconds = totalSeconds % 60;

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

    return () => clearInterval(timer);
  }, [lockTime]);

  async function checkUser() {
    const { data } =
      await supabase().auth.getUser();

    if (!data?.user) {
      setUser(null);
      setIsAdmin(false);
      return;
    }

    setUser(data.user);

    const { data: profile } =
      await supabase()
        .from("profiles")
        .select("is_admin")
        .eq("id", data.user.id)
        .maybeSingle();

    setIsAdmin(Boolean(profile?.is_admin));
  }

  async function loadPlayers() {
    const { data, error } =
      await supabase().functions.invoke(
        "player-login",
        {
          body: { action: "list" },
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
  }

  async function loadRound() {
    try {
      setLoading(true);

      const db = supabase();

      const {
        data: roundData,
        error: roundError,
      } = await db
        .from("rounds")
        .select(
          "id, round_number, status"
        )
        .eq("status", "open")
        .order("round_number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (roundError) throw roundError;

      if (!roundData) {
        setMessage(
          "No round is currently open."
        );
        return;
      }

      const {
        data: alertData,
        error: alertError,
      } = await db
        .from("fixture_change_alerts")
        .select(
          "id, message, created_at"
        )
        .eq(
          "round_id",
          roundData.id
        )
        .order("created_at", {
          ascending: false,
        });

      if (alertError) throw alertError;

      setAlerts(alertData || []);

      const {
        data: links,
        error: linksError,
      } = await db
        .from("round_fixtures")
        .select(
          "fixture_number, fixture_id"
        )
        .eq(
          "round_id",
          roundData.id
        )
        .order("fixture_number", {
          ascending: true,
        });

      if (linksError) throw linksError;

      const fixtureIds =
        (links || [])
          .map((x) => x.fixture_id)
          .filter(Boolean);

      if (fixtureIds.length === 0) {
        throw new Error(
          "This round currently has no fixtures."
        );
      }

      const {
        data: fixtures,
        error: fixtureError,
      } = await db
        .from("fixtures")
        .select(
          "id, home_team, away_team, kickoff"
        )
        .in("id", fixtureIds);

      if (fixtureError)
        throw fixtureError;

      const byId = Object.fromEntries(
        (fixtures || []).map((f) => [
          f.id,
          f,
        ])
      );

      const orderedGames =
        (links || [])
          .map(
            (x) => byId[x.fixture_id]
          )
          .filter(Boolean);

      if (orderedGames.length === 0) {
        throw new Error(
          "The selected fixtures could not be loaded."
        );
      }

      const earliestKickoff =
        orderedGames
          .map((game) =>
            new Date(
              game.kickoff
            ).getTime()
          )
          .sort(
            (a, b) => a - b
          )[0];

      setLockTime(
        new Date(
          earliestKickoff
        ).toISOString()
      );

      setLocked(
        earliestKickoff <=
          Date.now()
      );

      setRound(roundData);
      setGames(orderedGames);
      setMessage("");
    } catch (error) {
      setMessage(
        "Unable to load Pick 7: " +
          (error?.message ||
            "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkSubmitted(
    currentUser,
    currentRound
  ) {
    if (
      !currentUser ||
      !currentRound ||
      games.length === 0
    ) {
      return;
    }

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
      data.length === games.length
    ) {
      const saved = {};

      data.forEach((p) => {
        saved[p.fixture_id] = {
          home: p.predicted_home,
          away: p.predicted_away,
        };
      });

      setPredictions(saved);
      setSubmitted(true);

      setMessage(
        `Your ${games.length} picks are already submitted and locked.`
      );
    }
  }

  useEffect(() => {
    if (
      user &&
      round &&
      games.length > 0
    ) {
      checkSubmitted(
        user,
        round
      );
    }
  }, [user, round, games]);

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

    /*
      MOVE TO THE NEXT SCORE BOX

      This is deliberately done immediately
      from the input event rather than using a
      delayed timeout. This is more reliable on
      Android/mobile keyboards.

      Order:

      Game 1 Home
      Game 1 Away
      Game 2 Home
      Game 2 Away
      Game 3 Home
      Game 3 Away
      Game 4 Home
      Game 4 Away
      Game 5 Home
      Game 5 Away
      Game 6 Home
      Game 6 Away
      Game 7 Home
      Game 7 Away
    */

    if (
      value !== "" &&
      inputIndex !== undefined
    ) {
      const nextIndex =
        inputIndex + 1;

      const nextInput =
        scoreRefs.current[
          nextIndex
        ];

      if (nextInput) {
        nextInput.focus();

        try {
          nextInput.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        } catch (error) {
          // Ignore scrolling errors.
        }
      }
    }
  }

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

    const {
      data,
      error,
    } = await supabase().functions.invoke(
      "player-login",
      {
        body: {
          display_name:
            playerName,
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
      await supabase().auth.setSession(
        {
          access_token:
            data.access_token,
          refresh_token:
            data.refresh_token,
        }
      );

    if (sessionError) {
      setMessage(
        "Sign-in failed: " +
          sessionError.message
      );
      return;
    }

    setUser(sessionData.user);

    const { data: profile } =
      await supabase()
        .from("profiles")
        .select("is_admin")
        .eq(
          "id",
          sessionData.user.id
        )
        .maybeSingle();

    setIsAdmin(
      Boolean(profile?.is_admin)
    );

    setPassword("");

    setMessage(
      "You are signed in."
    );
  }

async function signOut() {
  // Clear the app immediately so sign-out feels instant.
  setUser(null);
  setIsAdmin(false);
  setSubmitted(false);
  setPredictions({});
  setChangePasswordOpen(false);
  setNewPassword("");
  setConfirmPassword("");
  setMessage("You have been signed out.");

  // Finish the Supabase sign-out in the background.
  try {
    await supabase().auth.signOut({ scope: "local" });
  } catch (error) {
    console.error("Sign-out error:", error);
  }
}

  async function changePassword() {
    if (changingPassword)
      return;

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

    const {
      error,
    } = await supabase()
      .auth.updateUser({
        password: newPassword,
      });

    if (error) {
      setMessage(
        "Could not change passcode: " +
          error.message
      );

      setChangingPassword(false);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setChangePasswordOpen(false);
    setChangingPassword(false);

    setMessage(
      "✅ Your passcode has been changed successfully."
    );
  }

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

    const incomplete =
      games.some((game) => {
        const p =
          predictions[
            game.id
          ];

        return (
          p?.home ===
            undefined ||
          p?.away ===
            undefined ||
          p?.home === "" ||
          p?.away === ""
        );
      });

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

    const rows =
      games.map((game) => ({
        round_id:
          round.id,
        fixture_id:
          game.id,
        player_id:
          user.id,
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
      }));

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

      setSubmitting(false);
      return;
    }

    setSubmitted(true);

    setMessage(
      `Your ${games.length} picks have been submitted and locked.`
    );

    setSubmitting(false);
  }

  function formatKickoff(
    kickoff
  ) {
    const date =
      new Date(kickoff);

    return date.toLocaleString(
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

            {alerts.map(
              (alert) => (
                <div
                  key={alert.id}
                  style={{
                    marginTop:
                      "6px",
                  }}
                >
                  {alert.message}
                </div>
              )
            )}
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

              {/* SIGN IN FIRST */}

              {!user && !locked && (
                <div
                  className="card"
                  style={{
                    marginBottom:
                      "18px",
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
                    onSubmit={
                      signIn
                    }
                  >

                    <select
                      value={
                        playerName
                      }
                      onChange={(
                        event
                      ) =>
                        setPlayerName(
                          event
                            .target
                            .value
                        )
                      }
                    >

                      <option value="">
                        Select your player name
                      </option>

                      {players.map(
                        (player) => (
                          <option
                            key={
                              player
                            }
                            value={
                              player
                            }
                          >
                            {
                              player
                            }
                          </option>
                        )
                      )}

                    </select>

                    <input
                      type="password"
                      placeholder="Password"
                      value={
                        password
                      }
                      onChange={(
                        event
                      ) =>
                        setPassword(
                          event
                            .target
                            .value
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

              {/* GAMES */}

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
                  (
                    game,
                    index
                  ) => {

                    const prediction =
                      predictions[
                        game.id
                      ] || {};

                    const homeRefIndex =
                      index * 2;

                    const awayRefIndex =
                      index * 2 + 1;

                    return (
                      <div
                        className="fixture"
                        key={
                          game.id
                        }
                      >

                        <div className="fixtureNumber">
                          GAME{" "}
                          {index + 1}
                        </div>

                        <div className="kickoff">
                          {formatKickoff(
                            game.kickoff
                          )}
                        </div>

                        <div className="teams">

                          {/* HOME TEAM */}

                          <div className="team">

                            <strong>
                              {
                                game.home_team
                              }
                            </strong>

                            <input
                              ref={(
                                element
                              ) => {
                                scoreRefs.current[
                                  homeRefIndex
                                ] =
                                  element;
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
                              onChange={(
                                event
                              ) =>
                                setScore(
                                  game.id,
                                  "home",
                                  event
                                    .target
                                    .value,
                                  homeRefIndex
                                )
                              }
                            />

                          </div>

                          <div className="vs">
                            V
                          </div>

                          {/* AWAY TEAM */}

                          <div className="team">

                            <input
                              ref={(
                                element
                              ) => {
                                scoreRefs.current[
                                  awayRefIndex
                                ] =
                                  element;
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
                              onChange={(
                                event
                              ) =>
                                setScore(
                                  game.id,
                                  "away",
                                  event
                                    .target
                                    .value,
                                  awayRefIndex
                                )
                              }
                            />

                            <strong>
                              {
                                game.away_team
                              }
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

              {/* SIGNED IN ACCOUNT AREA */}

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
                          onClick={
                            submit
                          }
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
                          onClick={
                            signOut
                          }
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
                          onClick={
                            signOut
                          }
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
                        marginTop:
                          "14px",
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
                          display:
                            "flex",
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
                          onChange={(
                            event
                          ) =>
                            setNewPassword(
                              event
                                .target
                                .value
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
                          onChange={(
                            event
                          ) =>
                            setConfirmPassword(
                              event
                                .target
                                .value
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
                            setNewPassword(
                              ""
                            );
                            setConfirmPassword(
                              ""
                            );
                          }}
                        >
                          CANCEL
                        </button>

                      </div>

                    </div>
                  )}

                  {/* ADMIN BUTTON */}

                  {isAdmin && (
                    <a
                      href="/admin"
                      className="btn"
                      style={{
                        display:
                          "block",
                        textAlign:
                          "center",
                        textDecoration:
                          "none",
                        marginTop:
                          "12px",
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
