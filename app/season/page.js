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
      // GET MATCH POINTS
      // --------------------------------------------------

      const {
        data: scoreData,
        error: scoreError,
      } = await db
        .from("round_scores")
        .select(
          "round_id, player_id, match_points"
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
      // BUILD SEASON POINTS
      //
      // Season Points are the player's Match Points
      // from every Pick 7 game added together.
      // --------------------------------------------------

      const leaderboard =
        profileList.map((profile) => {
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
                score.match_points || 0
              );
            });

          // Add all round Match Points together
          // to create Season Points.
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
        });

      // Highest Season Points first
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
  // POSITION STYLING
  // --------------------------------------------------

  function getPositionStyle(position) {
    if (position === 1) {
      return {
        border:
          "2px solid #f2c94c",
        background:
          "linear-gradient(90deg, rgba(242,201,76,0.18), rgba(242,201,76,0.05))",
      };
    }

    if (position === 2) {
      return {
        border:
          "2px solid #c7d0d9",
        background:
          "linear-gradient(90deg, rgba(199,208,217,0.14), rgba(199,208,217,0.04))",
      };
    }

    if (position === 3) {
      return {
        border:
          "2px solid #d98745",
        background:
          "linear-gradient(90deg, rgba(217,135,69,0.16), rgba(217,135,69,0.04))",
      };
    }

    return {
      border:
        "1px solid rgba(0,168,255,0.55)",
      background:
        "rgba(4,35,57,0.28)",
    };
  }

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
        "rgba(0,130,200,0.15)",
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
  // MAIN PAGE
  // --------------------------------------------------

  const completedRounds =
    rounds.filter(
      (round) =>
        String(
          round.status
        ).toLowerCase() ===
        "completed"
    );

  return (
    <main
      className="wrap"
      style={{
        paddingTop: "10px",
        paddingBottom: "10px",
      }}
    >

      {/* ------------------------------------------------
          HEADER
      ------------------------------------------------ */}

      <div
        className="card"
        style={{
          marginBottom: "8px",
          padding:
            "14px 16px",
        }}
      >

        <div
          className="muted"
          style={{
            fontSize: "12px",
            marginBottom: "3px",
          }}
        >
          SEASON LEAGUE
        </div>

        <h2
          style={{
            margin:
              "0 0 4px 0",
            fontSize: "25px",
            lineHeight: "1.1",
          }}
        >
          📊 Season Leaderboard
        </h2>

        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: "13px",
          }}
        >
          Season Points after{" "}
          {completedRounds.length}{" "}
          completed rounds.
        </p>

      </div>

      {/* ------------------------------------------------
          LEADERBOARD
      ------------------------------------------------ */}

      <div
        className="card"
        style={{
          padding: "8px",
          marginBottom: "8px",
        }}
      >

        <div
          style={{
            width: "100%",
            overflowX: "hidden",
          }}
        >

          {/* HEADER */}

          <div
            style={{
              display: "grid",

              gridTemplateColumns:
                "42px minmax(78px,1.4fr) repeat(5,minmax(43px,0.75fr)) minmax(55px,0.9fr)",

              gap: "3px",

              alignItems:
                "center",

              marginBottom:
                "4px",
            }}
          >

            <div
              style={{
                textAlign:
                  "center",
                fontWeight:
                  "800",
                fontSize:
                  "11px",
                border:
                  "2px solid rgba(0,150,220,0.65)",
                borderRadius:
                  "7px",
                padding:
                  "5px 1px",
              }}
            >
              Pos
            </div>

            <div
              style={{
                fontWeight:
                  "800",
                fontSize:
                  "11px",
                paddingLeft:
                  "5px",
              }}
            >
              Player
            </div>

            {completedRounds
              .slice(0, 5)
              .map((round) => (
                <div
                  key={round.id}
                  style={{
                    border:
                      "2px solid rgba(0,150,220,0.65)",
                    borderRadius:
                      "7px",
                    padding:
                      "5px 1px",
                    textAlign:
                      "center",
                    fontWeight:
                      "800",
                    fontSize:
                      "11px",
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
                  "2px solid rgba(0,150,220,0.8)",
                borderRadius:
                  "7px",
                padding:
                  "5px 1px",
                textAlign:
                  "center",
                fontWeight:
                  "800",
                fontSize:
                  "11px",
              }}
            >
              Season
            </div>

          </div>

          {/* PLAYERS */}

          <div
            style={{
              display:
                "flex",
              flexDirection:
                "column",
              gap: "3px",
            }}
          >

            {players.map(
              (player) => {

                const rowStyle =
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
                        "42px minmax(78px,1.4fr) repeat(5,minmax(43px,0.75fr)) minmax(55px,0.9fr)",

                      gap: "3px",

                      alignItems:
                        "center",

                      minHeight:
                        "35px",

                      padding:
                        "2px",

                      borderRadius:
                        "7px",

                      ...rowStyle,
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
                            "25px",
                          height:
                            "25px",
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
                            "12px",
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
                          "12px",
                        paddingLeft:
                          "3px",
                        whiteSpace:
                          "nowrap",
                        overflow:
                          "hidden",
                        textOverflow:
                          "ellipsis",
                      }}
                    >
                      {
                        player.name
                      }
                    </div>

                    {/* ROUNDS */}

                    {completedRounds
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
                                  "6px",

                                padding:
                                  "5px 1px",

                                textAlign:
                                  "center",

                                fontSize:
                                  "11px",

                                lineHeight:
                                  "1",

                                background:
                                  "rgba(0,50,85,0.22)",
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

                    {/* SEASON TOTAL */}

                    <div
                      style={{
                        border:
                          "2px solid rgba(0,150,220,0.8)",

                        borderRadius:
                          "6px",

                        padding:
                          "5px 1px",

                        textAlign:
                          "center",

                        fontSize:
                          "13px",

                        lineHeight:
                          "1",

                        fontWeight:
                          "900",

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

      {/* ------------------------------------------------
          HOW IT WORKS
      ------------------------------------------------ */}

      <div
        className="card"
        style={{
          padding:
            "10px 12px",
        }}
      >

        <h3
          style={{
            margin:
              "0 0 4px 0",
            fontSize: "14px",
          }}
        >
          ℹ️ How the Season Works
        </h3>

        <p
          className="muted"
          style={{
            margin: 0,
            fontSize: "11px",
            lineHeight:
              "1.35",
          }}
        >
          Every Pick 7 game earns
          Match Points: exact score =
          10, correct result = 6,
          wrong result = 0.
          These points are added together
          from every round to give your
          Season Points.
        </p>

      </div>

    </main>
  );
}
