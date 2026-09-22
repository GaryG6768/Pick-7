"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SeasonPage() {
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSeason();
  }, []);

  async function loadSeason() {
    try {
      setLoading(true);
      setMessage("");

      const db = supabase();

      // --------------------------------------------------
      // GET ROUNDS
      // --------------------------------------------------

      const {
        data: roundData,
        error: roundError,
      } = await db
        .from("rounds")
        .select("id, round_number, status")
        .order("round_number", {
          ascending: true,
        });

      if (roundError) {
        throw roundError;
      }

      const roundList = roundData || [];

      setRounds(roundList);

      // --------------------------------------------------
      // GET SEASON LEAGUE PLAYERS
      // --------------------------------------------------

      const {
        data: profileData,
        error: profileError,
      } = await db
        .from("profiles")
        .select(
          "id, display_name, season_league, season_league_start_round"
        )
        .eq("season_league", true)
        .eq("active", true)
        .order("display_name", {
          ascending: true,
        });

      if (profileError) {
        throw profileError;
      }

      const profileList = profileData || [];

      if (profileList.length === 0) {
        setPlayers([]);
        return;
      }

      const playerIds = profileList.map(
        (player) => player.id
      );

      // --------------------------------------------------
      // GET COMPETITION POINTS
      // --------------------------------------------------

      const {
        data: scoreData,
        error: scoreError,
      } = await db
        .from("round_scores")
        .select(
          "round_id, player_id, competition_points"
        )
        .in("player_id", playerIds);

      if (scoreError) {
        throw scoreError;
      }

      const scores = scoreData || [];

      const roundMap = Object.fromEntries(
        roundList.map((round) => [
          round.id,
          round,
        ])
      );

      // --------------------------------------------------
      // BUILD LEADERBOARD
      // --------------------------------------------------

      const leaderboard = profileList.map(
        (profile) => {
          const roundPoints = {};

          scores
            .filter(
              (score) =>
                score.player_id ===
                profile.id
            )
            .forEach((score) => {
              const round =
                roundMap[score.round_id];

              if (!round) {
                return;
              }

              const startRound =
                profile.season_league_start_round;

              if (
                startRound !== null &&
                startRound !== undefined &&
                round.round_number <
                  startRound
              ) {
                return;
              }

              roundPoints[
                score.round_id
              ] = Number(
                score.competition_points || 0
              );
            });

          const total =
            Object.values(roundPoints).reduce(
              (sum, points) =>
                sum + points,
              0
            );

          return {
            player_id: profile.id,

            name:
              profile.display_name ||
              "Player",

            rounds: roundPoints,

            total,
          };
        }
      );

      // Highest total first
      leaderboard.sort(
        (a, b) =>
          b.total - a.total ||
          a.name.localeCompare(b.name)
      );

      // --------------------------------------------------
      // POSITIONS
      // --------------------------------------------------

      let previousTotal = null;
      let previousPosition = 0;

      const positioned =
        leaderboard.map(
          (player, index) => {
            let position;

            if (
              previousTotal !== null &&
              player.total ===
                previousTotal
            ) {
              position =
                previousPosition;
            } else {
              position =
                index + 1;
            }

            previousTotal =
              player.total;

            previousPosition =
              position;

            return {
              ...player,
              position,
            };
          }
        );

      setPlayers(positioned);
    } catch (error) {
      console.error(
        "Season League error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load the Season League."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // POSITION STYLE
  // --------------------------------------------------

  function getPositionStyle(position) {
    if (position === 1) {
      return {
        border:
          "2px solid #f2c94c",
        background:
          "linear-gradient(90deg, rgba(242,201,76,0.20), rgba(242,201,76,0.06))",
        boxShadow:
          "0 0 8px rgba(242,201,76,0.18)",
      };
    }

    if (position === 2) {
      return {
        border:
          "2px solid #c7d0d9",
        background:
          "linear-gradient(90deg, rgba(199,208,217,0.16), rgba(199,208,217,0.05))",
      };
    }

    if (position === 3) {
      return {
        border:
          "2px solid #d98745",
        background:
          "linear-gradient(90deg, rgba(217,135,69,0.18), rgba(217,135,69,0.05))",
      };
    }

    return {
      border:
        "1px solid rgba(0,168,255,0.65)",
      background:
        "rgba(4,35,57,0.35)",
    };
  }

  // --------------------------------------------------
  // POSITION CIRCLE
  // --------------------------------------------------

  function getPositionCircle(position) {
    if (position === 1) {
      return {
        background:
          "linear-gradient(135deg, #fff3b0, #e5a900)",
        color: "#222",
      };
    }

    if (position === 2) {
      return {
        background:
          "linear-gradient(135deg, #ffffff, #aeb7c0)",
        color: "#222",
      };
    }

    if (position === 3) {
      return {
        background:
          "linear-gradient(135deg, #ffc078, #c76620)",
        color: "#222",
      };
    }

    return {
      background:
        "rgba(0,130,200,0.16)",
      color: "#fff",
    };
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            SEASON LEAGUE
          </div>

          <h2>
            Pick 7 Season
          </h2>

          <p className="muted">
            Loading Season League...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (message) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            SEASON LEAGUE
          </div>

          <h2>
            Pick 7 Season
          </h2>

          <div className="notice">
            {message}
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // PAGE
  // --------------------------------------------------

  return (
    <main className="wrap">

      {/* HEADER */}

      <div
        className="card"
        style={{
          marginBottom: "14px",
        }}
      >
        <div className="muted">
          SEASON LEAGUE
        </div>

        <h2
          style={{
            marginBottom: "6px",
          }}
        >
          📊 Season Leaderboard
        </h2>

        <p
          className="muted"
          style={{
            marginBottom: "0",
          }}
        >
          Competition Points after{" "}
          {
            rounds.filter(
              (round) =>
                String(
                  round.status
                ).toLowerCase() ===
                "completed"
            ).length
          }{" "}
          completed rounds.
        </p>
      </div>

      {/* LEADERBOARD */}

      <div
        className="card"
        style={{
          padding: "12px",
        }}
      >

        <div
          style={{
            width: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling:
              "touch",
          }}
        >

          <div
            style={{
              minWidth: "690px",
            }}
          >

            {/* HEADER ROW */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "72px 190px repeat(5, 1fr) 120px",
                gap: "6px",
                alignItems: "center",
                padding:
                  "8px 4px 10px 4px",
              }}
            >

              <div
                style={{
                  fontWeight: "700",
                  textAlign: "center",
                  fontSize: "14px",
                }}
              >
                Pos
              </div>

              <div
                style={{
                  fontWeight: "700",
                  fontSize: "14px",
                }}
              >
                Player
              </div>

              {rounds
                .slice(0, 5)
                .map((round) => (
                  <div
                    key={round.id}
                    style={{
                      border:
                        "2px solid rgba(0,150,220,0.65)",
                      borderRadius:
                        "9px",
                      padding:
                        "7px 3px",
                      textAlign:
                        "center",
                      fontWeight:
                        "700",
                      background:
                        "rgba(0,80,125,0.16)",
                    }}
                  >
                    R
                    {
                      round.round_number
                    }
                  </div>
                ))}

              <div
                style={{
                  border:
                    "2px solid rgba(0,150,220,0.65)",
                  borderRadius:
                    "9px",
                  padding:
                    "7px 3px",
                  textAlign:
                    "center",
                  fontWeight: "700",
                  background:
                    "rgba(0,80,125,0.16)",
                }}
              >
                Total
              </div>
            </div>

            {/* PLAYER ROWS */}

            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: "6px",
              }}
            >

              {players.map(
                (player) => {

                  const positionStyle =
                    getPositionStyle(
                      player.position
                    );

                  const circleStyle =
                    getPositionCircle(
                      player.position
                    );

                  return (
                    <div
                      key={
                        player.player_id
                      }
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "72px 190px repeat(5, 1fr) 120px",
                        gap: "6px",
                        alignItems:
                          "center",
                        minHeight:
                          "48px",
                        padding:
                          "4px",
                        borderRadius:
                          "10px",
                        ...positionStyle,
                      }}
                    >

                      {/* POSITION */}

                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "center",
                        }}
                      >
                        <div
                          style={{
                            width:
                              "36px",
                            height:
                              "36px",
                            borderRadius:
                              "50%",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontWeight:
                              "800",
                            fontSize:
                              "17px",
                            ...circleStyle,
                          }}
                        >
                          {
                            player.position
                          }
                        </div>
                      </div>

                      {/* PLAYER */}

                      <div
                        style={{
                          fontWeight:
                            "700",
                          fontSize:
                            "15px",
                          paddingLeft:
                            "6px",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          player.name
                        }
                      </div>

                      {/* ROUND SCORES */}

                      {rounds
                        .slice(0, 5)
                        .map(
                          (round) => {

                            const value =
                              player
                                .rounds[
                                round.id
                              ];

                            return (
                              <div
                                key={
                                  round.id
                                }
                                style={{
                                  border:
                                    "2px solid rgba(0,150,220,0.65)",
                                  borderRadius:
                                    "8px",
                                  padding:
                                    "7px 3px",
                                  textAlign:
                                    "center",
                                  fontSize:
                                    "14px",
                                  background:
                                    "rgba(0,50,85,0.25)",
                                  minWidth:
                                    "0",
                                }}
                              >
                                {
                                  value ??
                                  "–"
                                }
                              </div>
                            );
                          }
                        )}

                      {/* TOTAL */}

                      <div
                        style={{
                          border:
                            "2px solid rgba(0,150,220,0.8)",
                          borderRadius:
                            "8px",
                          padding:
                            "7px 3px",
                          textAlign:
                            "center",
                          fontSize:
                            "17px",
                          fontWeight:
                            "800",
                          background:
                            "rgba(0,80,125,0.25)",
                        }}
                      >
                        {
                          player.total
                        }
                      </div>

                    </div>
                  );
                }
              )}

            </div>

          </div>

        </div>

      </div>

      {/* INFORMATION */}

      <div
        className="card"
        style={{
          marginTop: "14px",
        }}
      >

        <h3>
          How the Season Works
        </h3>

        <p className="muted">
          Every completed Pick 7 round
          contributes Competition Points
          to your Season League total.
          <br />
          <br />
          Competition Points are awarded
          according to your finishing
          position in each round.
          <br />
          <br />
          If you join the Season League
          after the season has started,
          only rounds from your joining
          round onwards count towards
          your Season total.
        </p>

      </div>

    </main>
  );
}
