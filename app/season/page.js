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

      const {
        data: roundData,
        error: roundError,
      } = await db
        .from("rounds")
        .select("id, round_number, status")
        .order("round_number", {
          ascending: true,
        });

      if (roundError) throw roundError;

      const roundList = roundData || [];

      setRounds(roundList);

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

      if (profileError) throw profileError;

      const profileList = profileData || [];

      if (profileList.length === 0) {
        setPlayers([]);
        return;
      }

      const playerIds = profileList.map(
        (player) => player.id
      );

      /*
       * IMPORTANT:
       * Season Points are the player's
       * MATCH POINTS added together.
       *
       * Exact score = 10
       * Correct result = 6
       * Wrong result = 0
       */

      const {
        data: scoreData,
        error: scoreError,
      } = await db
        .from("round_scores")
        .select(
          "round_id, player_id, match_points"
        )
        .in("player_id", playerIds);

      if (scoreError) throw scoreError;

      const scores = scoreData || [];

      const roundMap = Object.fromEntries(
        roundList.map((round) => [
          round.id,
          round,
        ])
      );

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

              if (!round) return;

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

      leaderboard.sort(
        (a, b) =>
          b.total - a.total ||
          a.name.localeCompare(b.name)
      );

      /*
       * Shared positions for tied Season Points.
       */

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

  /*
   * TOP THREE ROW STYLES
   */

  function getRowStyle(position) {
    if (position === 1) {
      return {
        border:
          "2px solid #f2c94c",
        background:
          "linear-gradient(90deg, rgba(242,201,76,0.18), rgba(242,201,76,0.04))",
        boxSizing: "border-box",
      };
    }

    if (position === 2) {
      return {
        border:
          "2px solid #c7d0d9",
        background:
          "linear-gradient(90deg, rgba(199,208,217,0.14), rgba(199,208,217,0.04))",
        boxSizing: "border-box",
      };
    }

    if (position === 3) {
      return {
        border:
          "2px solid #d98745",
        background:
          "linear-gradient(90deg, rgba(217,135,69,0.16), rgba(217,135,69,0.04))",
        boxSizing: "border-box",
      };
    }

    return {
      border:
        "1px solid rgba(0,168,255,0.55)",
      background:
        "rgba(4,35,57,0.28)",
      boxSizing: "border-box",
    };
  }

  /*
   * POSITION CIRCLE
   */

  function getCircleStyle(position) {
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

  /*
   * LOADING
   */

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            SEASON LEAGUE
          </div>

          <h2>
            Season Leaderboard
          </h2>

          <p className="muted">
            Loading Season League...
          </p>
        </div>
      </main>
    );
  }

  /*
   * ERROR
   */

  if (message) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            SEASON LEAGUE
          </div>

          <h2>
            Season Leaderboard
          </h2>

          <div className="notice">
            {message}
          </div>
        </div>
      </main>
    );
  }

  const completedRounds =
    rounds
      .filter(
        (round) =>
          String(
            round.status
          ).toLowerCase() ===
          "completed"
      )
      .slice(0, 5);

  /*
   * COMPACT COLUMN WIDTHS
   *
   * These deliberately add up to fit
   * inside a normal mobile screen.
   */

  const columns =
    "30px minmax(58px,1fr) repeat(5,32px) 43px";

  return (
    <main
      className="wrap"
      style={{
        paddingTop: "5px",
        paddingBottom: "7px",
        width: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >

      {/* HEADER */}

      <div
        className="card"
        style={{
          marginBottom: "6px",
          padding:
            "9px 12px",
          boxSizing:
            "border-box",
          width: "100%",
        }}
      >

        <div
          className="muted"
          style={{
            fontSize: "10px",
            marginBottom: "2px",
          }}
        >
          SEASON LEAGUE
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: "22px",
            lineHeight: "1.05",
          }}
        >
          📊 Season Leaderboard
        </h2>

        <p
          className="muted"
          style={{
            margin:
              "3px 0 0 0",
            fontSize: "11px",
          }}
        >
          Season Points after{" "}
          {completedRounds.length}{" "}
          completed rounds.
        </p>

      </div>

      {/* LEADERBOARD */}

      <div
        className="card"
        style={{
          padding: "5px",
          marginBottom: "6px",
          width: "100%",
          boxSizing:
            "border-box",
          overflowX: "hidden",
        }}
      >

        {/* TABLE HEADER */}

        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              columns,

            gap: "2px",

            alignItems:
              "center",

            width: "100%",

            boxSizing:
              "border-box",

            marginBottom:
              "3px",
          }}
        >

          <div
            style={{
              textAlign:
                "center",
              fontWeight:
                "800",
              fontSize:
                "9px",
              border:
                "2px solid rgba(0,150,220,0.65)",
              borderRadius:
                "6px",
              padding:
                "4px 0",
              boxSizing:
                "border-box",
            }}
          >
            Pos
          </div>

          <div
            style={{
              fontWeight:
                "800",
              fontSize:
                "9px",
              paddingLeft:
                "2px",
              whiteSpace:
                "nowrap",
            }}
          >
            Player
          </div>

          {completedRounds.map(
            (round) => (
              <div
                key={round.id}
                style={{
                  border:
                    "2px solid rgba(0,150,220,0.65)",
                  borderRadius:
                    "6px",
                  padding:
                    "4px 0",
                  textAlign:
                    "center",
                  fontWeight:
                    "800",
                  fontSize:
                    "9px",
                  boxSizing:
                    "border-box",
                }}
              >
                R
                {
                  round.round_number
                }
              </div>
            )
          )}

          <div
            style={{
              border:
                "2px solid rgba(0,150,220,0.8)",
              borderRadius:
                "6px",
              padding:
                "4px 0",
              textAlign:
                "center",
              fontWeight:
                "800",
              fontSize:
                "8px",
              boxSizing:
                "border-box",
              whiteSpace:
                "nowrap",
            }}
          >
            Total
          </div>

        </div>

        {/* PLAYER ROWS */}

        <div
          style={{
            display:
              "flex",
            flexDirection:
              "column",
            gap: "2px",
            width: "100%",
          }}
        >

          {players.map(
            (player) => (
              <div
                key={
                  player.player_id
                }
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    columns,

                  gap: "2px",

                  alignItems:
                    "center",

                  minHeight:
                    "31px",

                  padding:
                    "2px",

                  borderRadius:
                    "8px",

                  width:
                    "100%",

                  boxSizing:
                    "border-box",

                  overflow:
                    "hidden",

                  ...getRowStyle(
                    player.position
                  ),
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
                        "22px",
                      height:
                        "22px",
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
                        "10px",
                      ...getCircleStyle(
                        player.position
                      ),
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
                      "10px",
                    paddingLeft:
                      "1px",
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

                {/* R1-R5 */}

                {completedRounds.map(
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
                            "5px",
                          padding:
                            "5px 0",
                          textAlign:
                            "center",
                          fontSize:
                            "9px",
                          lineHeight:
                            "1",
                          background:
                            "rgba(0,50,85,0.22)",
                          boxSizing:
                            "border-box",
                          width:
                            "100%",
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
                      "5px",
                    padding:
                      "5px 0",
                    textAlign:
                      "center",
                    fontSize:
                      "10px",
                    lineHeight:
                      "1",
                    fontWeight:
                      "900",
                    background:
                      "rgba(0,80,125,0.25)",
                    boxSizing:
                      "border-box",
                    width:
                      "100%",
                  }}
                >
                  {
                    player.total
                  }
                </div>

              </div>
            )
          )}

        </div>

      </div>

      {/* HOW IT WORKS */}

      <div
        className="card"
        style={{
          padding:
            "7px 9px",
          width: "100%",
          boxSizing:
            "border-box",
        }}
      >

        <h3
          style={{
            margin:
              "0 0 3px 0",
            fontSize:
              "12px",
          }}
        >
          ℹ️ How the Season Works
        </h3>

        <p
          className="muted"
          style={{
            margin: 0,
            fontSize:
              "9px",
            lineHeight:
              "1.3",
          }}
        >
          Exact score = 10 points.
          Correct result = 6 points.
          Wrong result = 0 points.
          All Match Points are added
          together to give your Season
          Points.
        </p>

      </div>

    </main>
  );
}
