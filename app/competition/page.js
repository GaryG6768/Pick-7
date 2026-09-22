"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CompetitionPage() {
  const [competition, setCompetition] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundScores, setRoundScores] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [openRound, setOpenRound] = useState(null);
  const [roundDetails, setRoundDetails] = useState({});
  const [loadingRound, setLoadingRound] = useState(null);

  useEffect(() => {
    loadCompetition();
  }, []);

  // --------------------------------------------------
  // GAME / ROUND DISPLAY
  // --------------------------------------------------

  function getGameNumber(roundNumber) {
    return Math.floor((Number(roundNumber) - 1) / 5) + 1;
  }

  function getGameRound(roundNumber) {
    return ((Number(roundNumber) - 1) % 5) + 1;
  }

  function getRoundLabel(roundNumber) {
    return `GAME ${getGameNumber(roundNumber)} • ROUND ${getGameRound(
      roundNumber
    )}`;
  }

  // --------------------------------------------------
  // COMPETITION
  // --------------------------------------------------

  async function loadCompetition() {
    try {
      setLoading(true);
      setMessage("");

      const db = supabase();

      const { data: competitionData, error: competitionError } =
        await db
          .from("competitions")
          .select("id, name, rounds_total, current_round, status")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (competitionError) throw competitionError;

      if (!competitionData) {
        setCompetition(null);
        setRounds([]);
        setRoundScores([]);
        return;
      }

      setCompetition(competitionData);

      // --------------------------------------------------
      // ROUNDS
      // --------------------------------------------------

      const { data: roundData, error: roundError } = await db
        .from("rounds")
        .select("id, round_number, status")
        .eq("competition_id", competitionData.id)
        .order("round_number", { ascending: true });

      if (roundError) throw roundError;

      const roundList = roundData || [];

      setRounds(roundList);

      if (roundList.length === 0) {
        setRoundScores([]);
        return;
      }

      const roundIds = roundList.map((round) => round.id);

      // --------------------------------------------------
      // ROUND SCORES
      // --------------------------------------------------

      const { data: scoreData, error: scoreError } = await db
        .from("round_scores")
        .select(
          "round_id, player_id, match_points, competition_points, position, entered"
        )
        .in("round_id", roundIds);

      if (scoreError) throw scoreError;

      setRoundScores(scoreData || []);

      // --------------------------------------------------
      // PLAYER NAMES
      // --------------------------------------------------

      const playerIds = [
        ...new Set((scoreData || []).map((score) => score.player_id)),
      ];

      if (playerIds.length > 0) {
        const { data: profileData, error: profileError } = await db
          .from("profiles")
          .select("id, display_name")
          .in("id", playerIds);

        if (profileError) throw profileError;

        const profileMap = {};

        (profileData || []).forEach((profile) => {
          profileMap[profile.id] = profile.display_name || "Player";
        });

        setProfiles(profileMap);
      }
    } catch (error) {
      console.error("Competition loading error:", error);

      setMessage(error?.message || "Unable to load the competition.");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // LOAD COMPLETED ROUND
  // --------------------------------------------------

  async function loadRoundDetails(roundId) {
    if (roundDetails[roundId]) {
      return;
    }

    setLoadingRound(roundId);

    try {
      const { data, error } = await supabase().rpc(
        "get_completed_pick7_round_details",
        {
          p_round_id: roundId,
        }
      );

      if (error) throw error;

      const rows = data || [];

      const fixtureIds = [
        ...new Set(
          rows.map((row) => row.fixture_id).filter(Boolean)
        ),
      ];

      let fixtures = [];

      if (fixtureIds.length > 0) {
        const { data: fixtureData, error: fixtureError } = await supabase()
          .from("fixtures")
          .select("id, home_team, away_team")
          .in("id", fixtureIds);

        if (fixtureError) throw fixtureError;

        fixtures = fixtureData || [];
      }

      const fixtureMap = Object.fromEntries(
        fixtures.map((fixture) => [fixture.id, fixture])
      );

      const enrichedRows = rows.map((row) => ({
        ...row,
        home_team: fixtureMap[row.fixture_id]?.home_team || "",
        away_team: fixtureMap[row.fixture_id]?.away_team || "",
      }));

      setRoundDetails((current) => ({
        ...current,
        [roundId]: enrichedRows,
      }));
    } catch (error) {
      console.error("Round details error:", error);

      setMessage(
        "Unable to load round results: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoadingRound(null);
    }
  }

  // --------------------------------------------------
  // OPEN / CLOSE ROUND
  // --------------------------------------------------

  async function toggleRound(round) {
    const completed =
      String(round.status).toLowerCase() === "completed";

    if (!completed) {
      return;
    }

    if (openRound === round.id) {
      setOpenRound(null);
      return;
    }

    setOpenRound(round.id);

    await loadRoundDetails(round.id);
  }

  // --------------------------------------------------
  // GET SCORES FOR ROUND
  // --------------------------------------------------

  function getScoresForRound(roundId) {
    return roundScores.filter(
      (score) => score.round_id === roundId
    );
  }

  // --------------------------------------------------
  // BUILD PLAYER RESULTS
  // --------------------------------------------------

  function buildPlayerResults(details, roundId) {
    const players = {};

    details.forEach((row) => {
      if (!players[row.player_id]) {
        players[row.player_id] = {
          player_id: row.player_id,

          name:
            row.display_name ||
            profiles[row.player_id] ||
            "Player",

          games: {},

          total: 0,
        };
      }

      const points = Number(row.points || 0);

      players[row.player_id].games[row.fixture_number] = {
        points,

        prediction: `${row.predicted_home} - ${row.predicted_away}`,

        actual: `${row.actual_home} - ${row.actual_away}`,

        home_team: row.home_team,

        away_team: row.away_team,
      };

      players[row.player_id].total += points;
    });

    const scores = getScoresForRound(roundId);

    Object.values(players).forEach((player) => {
      const score = scores.find(
        (item) => item.player_id === player.player_id
      );

      if (score) {
        player.competitionPoints = Number(
          score.competition_points || 0
        );

        player.position = score.position;
      } else {
        player.competitionPoints = 0;
        player.position = "-";
      }
    });

    return Object.values(players).sort(
      (a, b) =>
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );
  }

  // --------------------------------------------------
  // GET FIXTURES
  // --------------------------------------------------

  function getFixtures(details) {
    const fixtures = {};

    details.forEach((row) => {
      if (!fixtures[row.fixture_number]) {
        fixtures[row.fixture_number] = {
          fixture_number: row.fixture_number,

          fixture_id: row.fixture_id,

          actual_home: row.actual_home,

          actual_away: row.actual_away,

          home_team: row.home_team,

          away_team: row.away_team,
        };
      }
    });

    return Object.values(fixtures).sort(
      (a, b) => a.fixture_number - b.fixture_number
    );
  }

  // --------------------------------------------------
  // COMPETITION LEADERBOARD
  // --------------------------------------------------

  function buildLeaderboard() {
    const playerMap = {};

    roundScores.forEach((score) => {
      if (!playerMap[score.player_id]) {
        playerMap[score.player_id] = {
          player_id: score.player_id,

          name:
            profiles[score.player_id] ||
            "Player",

          total: 0,

          rounds: {},
        };
      }

      const points = Number(
        score.competition_points || 0
      );

      playerMap[score.player_id].total += points;

      playerMap[score.player_id].rounds[score.round_id] =
        points;
    });

    const players = Object.values(playerMap).sort(
      (a, b) =>
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );

    let previousTotal = null;
    let previousPosition = 0;

    return players.map((player, index) => {
      let position;

      if (
        previousTotal !== null &&
        player.total === previousTotal
      ) {
        position = previousPosition;
      } else {
        position = index + 1;
      }

      previousTotal = player.total;
      previousPosition = position;

      return {
        ...player,
        position,
      };
    });
  }

  // --------------------------------------------------
  // POSITION STYLE
  // --------------------------------------------------

  function getPositionStyle(position) {
    if (position === 1) {
      return {
        border: "2px solid #f5c842",
        background:
          "linear-gradient(90deg, rgba(245,200,66,0.16), rgba(255,255,255,0.04))",
        badgeBackground: "#f5c842",
        badgeColor: "#111",
      };
    }

    if (position === 2) {
      return {
        border: "2px solid #c9d2dc",
        background:
          "linear-gradient(90deg, rgba(201,210,220,0.14), rgba(255,255,255,0.04))",
        badgeBackground: "#e6ebf0",
        badgeColor: "#222",
      };
    }

    if (position === 3) {
      return {
        border: "2px solid #e59443",
        background:
          "linear-gradient(90deg, rgba(229,148,67,0.14), rgba(255,255,255,0.04))",
        badgeBackground: "#e59443",
        badgeColor: "#111",
      };
    }

    return {
      border: "2px solid rgba(0,140,210,0.75)",
      background: "rgba(255,255,255,0.025)",
      badgeBackground: "rgba(0,90,140,0.35)",
      badgeColor: "#fff",
    };
  }

  // --------------------------------------------------
  // ROUND SCORE BOX
  // --------------------------------------------------

  function RoundScoreBox({ round, player }) {
    const value = player.rounds[round.id];

    return (
      <div
        style={{
          minWidth: 0,
          textAlign: "center",
          padding: "7px 3px",
          borderRadius: "10px",
          border: "2px solid rgba(0,140,210,0.8)",
          background: "rgba(0,70,110,0.18)",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: "700",
            opacity: 0.75,
            marginBottom: "3px",
          }}
        >
          R{getGameRound(round.round_number)}
        </div>

        <strong
          style={{
            fontSize: "15px",
            whiteSpace: "nowrap",
          }}
        >
          {value ?? "–"}
        </strong>
      </div>
    );
  }

  // --------------------------------------------------
  // LEADERBOARD PLAYER CARD
  // --------------------------------------------------

  function LeaderboardPlayer({ player }) {
    const style = getPositionStyle(player.position);

    const game1Rounds = rounds.filter(
      (round) => getGameNumber(round.round_number) === 1
    );

    const game2Rounds = rounds.filter(
      (round) => getGameNumber(round.round_number) === 2
    );

    return (
      <div
        style={{
          borderRadius: "14px",
          border: style.border,
          background: style.background,
          padding: "10px",
          boxSizing: "border-box",
        }}
      >
        {/* PLAYER HEADER */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          {/* POSITION */}

          <div
            style={{
              width: "42px",
              height: "42px",
              minWidth: "42px",
              borderRadius: "50%",
              background: style.badgeBackground,
              color: style.badgeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "17px",
              fontWeight: "800",
            }}
          >
            {player.position}
          </div>

          {/* NAME */}

          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                fontSize: "17px",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {player.name}
            </strong>
          </div>

          {/* TOTAL */}

          <div
            style={{
              textAlign: "right",
              minWidth: "55px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                opacity: 0.7,
                fontWeight: "700",
              }}
            >
              TOTAL
            </div>

            <strong
              style={{
                fontSize: "19px",
              }}
            >
              {player.total}
            </strong>
          </div>
        </div>

        {/* GAME 1 */}

        {game1Rounds.length > 0 && (
          <div
            style={{
              marginBottom:
                game2Rounds.length > 0 ? "10px" : "0",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "0.5px",
                marginBottom: "5px",
                opacity: 0.7,
              }}
            >
              GAME 1
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(
                  game1Rounds.length,
                  5
                )}, minmax(0, 1fr))`,
                gap: "5px",
              }}
            >
              {game1Rounds.map((round) => (
                <RoundScoreBox
                  key={round.id}
                  round={round}
                  player={player}
                />
              ))}
            </div>
          </div>
        )}

        {/* GAME 2 */}

        {game2Rounds.length > 0 && (
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "800",
                letterSpacing: "0.5px",
                marginBottom: "5px",
                opacity: 0.7,
              }}
            >
              GAME 2
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(
                  game2Rounds.length,
                  5
                )}, minmax(0, 1fr))`,
                gap: "5px",
              }}
            >
              {game2Rounds.map((round) => (
                <RoundScoreBox
                  key={round.id}
                  round={round}
                  player={player}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            5 ROUND COMPETITION
          </div>

          <h2>5 Rounds</h2>

          <p className="muted">
            Loading competition...
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
            5 ROUND COMPETITION
          </div>

          <h2>5 Rounds</h2>

          <div className="notice">
            {message}
          </div>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // NO COMPETITION
  // --------------------------------------------------

  if (!competition) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            5 ROUND COMPETITION
          </div>

          <h2>5 Rounds</h2>

          <p className="muted">
            No competition has been created yet.
          </p>
        </div>
      </main>
    );
  }

  const leaderboard = buildLeaderboard();

  // --------------------------------------------------
  // MAIN PAGE
  // --------------------------------------------------

  return (
    <main className="wrap">

      {/* HEADER */}

      <div className="card">
        <div className="muted">
          5 ROUND COMPETITION
        </div>

        <h2>
          {competition.name ||
            "Pick 7 Competition"}
        </h2>

        <p className="muted">
          Five rounds of Pick 7.
          <br />
          <br />
          Completed rounds show everyone's
          results, predictions and points.
        </p>
      </div>

      {/* ROUNDS */}

      <div className="card">
        <h3>Competition Rounds</h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {rounds.map((round) => {
            const completed =
              String(round.status).toLowerCase() ===
              "completed";

            const isOpen =
              openRound === round.id;

            const details =
              roundDetails[round.id] || [];

            const playerResults =
              buildPlayerResults(
                details,
                round.id
              );

            const fixtures =
              getFixtures(details);

            return (
              <div
                key={round.id}
                style={{
                  borderRadius: "12px",
                  background:
                    "rgba(255,255,255,0.05)",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >

                {/* ROUND BUTTON */}

                <button
                  type="button"
                  onClick={() =>
                    toggleRound(round)
                  }
                  disabled={!completed}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems: "center",
                    padding: "16px",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    cursor: completed
                      ? "pointer"
                      : "default",
                    fontSize: "16px",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <strong>
                      {getRoundLabel(
                        round.round_number
                      )}
                    </strong>
                  </div>

                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span className="muted">
                      {String(
                        round.status ||
                          "NOT STARTED"
                      ).toUpperCase()}
                    </span>

                    {completed && (
                      <span>
                        {isOpen ? "▲" : "▼"}
                      </span>
                    )}
                  </span>
                </button>

                {/* OPEN ROUND */}

                {isOpen && (
                  <div
                    style={{
                      padding:
                        "0 12px 16px 12px",
                      borderTop:
                        "1px solid rgba(255,255,255,0.08)",
                    }}
                  >

                    {loadingRound ===
                      round.id && (
                      <div
                        style={{
                          padding: "20px 0",
                          textAlign: "center",
                        }}
                      >
                        <p className="muted">
                          Loading{" "}
                          {getRoundLabel(
                            round.round_number
                          )}{" "}
                          results...
                        </p>
                      </div>
                    )}

                    {loadingRound !==
                      round.id &&
                      details.length === 0 && (
                      <div
                        style={{
                          padding: "20px 0",
                        }}
                      >
                        <p className="muted">
                          No completed results
                          are available yet.
                        </p>
                      </div>
                    )}

                    {loadingRound !==
                      round.id &&
                      details.length > 0 && (
                      <>

                        {/* ACTUAL RESULTS */}

                        <div
                          style={{
                            marginTop: "14px",
                            marginBottom: "20px",
                          }}
                        >
                          <div
                            className="muted"
                            style={{
                              marginBottom: "10px",
                            }}
                          >
                            ACTUAL RESULTS
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(2, minmax(0, 1fr))",
                              gap: "8px",
                            }}
                          >
                            {fixtures.map(
                              (fixture) => (
                                <div
                                  key={
                                    fixture.fixture_number
                                  }
                                  style={{
                                    padding: "10px 6px",
                                    borderRadius:
                                      "10px",
                                    background:
                                      "rgba(255,255,255,0.04)",
                                    textAlign:
                                      "center",
                                  }}
                                >
                                  <div
                                    className="muted"
                                    style={{
                                      fontSize:
                                        "11px",
                                      marginBottom:
                                        "4px",
                                    }}
                                  >
                                    G
                                    {
                                      fixture.fixture_number
                                    }
                                  </div>

                                  <div
                                    style={{
                                      fontSize:
                                        "12px",
                                      lineHeight:
                                        "1.3",
                                    }}
                                  >
                                    {
                                      fixture.home_team
                                    }
                                    <br />
                                    <span className="muted">
                                      v
                                    </span>
                                    <br />
                                    {
                                      fixture.away_team
                                    }
                                  </div>

                                  <strong
                                    style={{
                                      display:
                                        "block",
                                      marginTop:
                                        "6px",
                                      fontSize:
                                        "16px",
                                    }}
                                  >
                                    {
                                      fixture.actual_home
                                    }{" "}
                                    -{" "}
                                    {
                                      fixture.actual_away
                                    }
                                  </strong>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        {/* PLAYER RESULTS */}

                        <div>
                          <div
                            className="muted"
                            style={{
                              marginBottom: "10px",
                            }}
                          >
                            PLAYER RESULTS
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection:
                                "column",
                              gap: "10px",
                            }}
                          >
                            {playerResults.map(
                              (player) => (
                                <div
                                  key={
                                    player.player_id
                                  }
                                  style={{
                                    padding: "12px",
                                    borderRadius:
                                      "12px",
                                    background:
                                      "rgba(255,255,255,0.04)",
                                    border:
                                      "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >

                                  {/* PLAYER NAME */}

                                  <div
                                    style={{
                                      display:
                                        "flex",
                                      justifyContent:
                                        "space-between",
                                      alignItems:
                                        "center",
                                      gap: "8px",
                                      marginBottom:
                                        "10px",
                                    }}
                                  >
                                    <strong
                                      style={{
                                        fontSize:
                                          "15px",
                                      }}
                                    >
                                      {player.name}
                                    </strong>

                                    <strong>
                                      {player.total}{" "}
                                      MATCH POINTS
                                    </strong>
                                  </div>

                                  {/* 7 GAMES */}

                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "repeat(7, minmax(0, 1fr))",
                                      gap: "4px",
                                    }}
                                  >
                                    {[
                                      1,
                                      2,
                                      3,
                                      4,
                                      5,
                                      6,
                                      7,
                                    ].map(
                                      (number) => {
                                        const game =
                                          player
                                            .games[
                                            number
                                          ];

                                        return (
                                          <div
                                            key={
                                              number
                                            }
                                            style={{
                                              textAlign:
                                                "center",
                                              padding:
                                                "7px 2px",
                                              borderRadius:
                                                "7px",
                                              background:
                                                "rgba(255,255,255,0.05)",
                                            }}
                                          >
                                            <div
                                              className="muted"
                                              style={{
                                                fontSize:
                                                  "10px",
                                              }}
                                            >
                                              G
                                              {
                                                number
                                              }
                                            </div>

                                            <strong
                                              style={{
                                                fontSize:
                                                  "14px",
                                              }}
                                            >
                                              {game
                                                ? game.points
                                                : "-"}
                                            </strong>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>

                                  {/* ROUND POSITION / COMPETITION POINTS */}

                                  <div
                                    style={{
                                      display:
                                        "grid",
                                      gridTemplateColumns:
                                        "1fr 1fr",
                                      gap: "8px",
                                      marginTop:
                                        "10px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        padding:
                                          "8px",
                                        borderRadius:
                                          "8px",
                                        background:
                                          "rgba(255,255,255,0.04)",
                                        textAlign:
                                          "center",
                                      }}
                                    >
                                      <div
                                        className="muted"
                                        style={{
                                          fontSize:
                                            "10px",
                                        }}
                                      >
                                        ROUND POSITION
                                      </div>

                                      <strong>
                                        {
                                          player.position
                                        }
                                      </strong>
                                    </div>

                                    <div
                                      style={{
                                        padding:
                                          "8px",
                                        borderRadius:
                                          "8px",
                                        background:
                                          "rgba(255,255,255,0.04)",
                                        textAlign:
                                          "center",
                                      }}
                                    >
                                      <div
                                        className="muted"
                                        style={{
                                          fontSize:
                                            "10px",
                                        }}
                                      >
                                        COMPETITION
                                        POINTS
                                      </div>

                                      <strong>
                                        {
                                          player.competitionPoints
                                        }
                                      </strong>
                                    </div>
                                  </div>

                                  {/* INDIVIDUAL PICKS */}

                                  <details
                                    style={{
                                      marginTop:
                                        "10px",
                                    }}
                                  >
                                    <summary
                                      style={{
                                        cursor:
                                          "pointer",
                                        fontWeight:
                                          "600",
                                        padding:
                                          "6px 0",
                                      }}
                                    >
                                      View Predictions
                                    </summary>

                                    <div
                                      style={{
                                        marginTop:
                                          "6px",
                                      }}
                                    >
                                      {[
                                        1,
                                        2,
                                        3,
                                        4,
                                        5,
                                        6,
                                        7,
                                      ].map(
                                        (number) => {
                                          const game =
                                            player
                                              .games[
                                              number
                                            ];

                                          if (
                                            !game
                                          ) {
                                            return null;
                                          }

                                          return (
                                            <div
                                              key={
                                                number
                                              }
                                              style={{
                                                padding:
                                                  "10px 2px",
                                                borderBottom:
                                                  "1px solid rgba(255,255,255,0.06)",
                                              }}
                                            >
                                              <div
                                                className="muted"
                                                style={{
                                                  fontSize:
                                                    "12px",
                                                }}
                                              >
                                                G
                                                {
                                                  number
                                                }{" "}
                                                •{" "}
                                                {
                                                  game.home_team
                                                }{" "}
                                                v{" "}
                                                {
                                                  game.away_team
                                                }
                                              </div>

                                              <div
                                                style={{
                                                  display:
                                                    "flex",
                                                  justifyContent:
                                                    "space-between",
                                                  gap:
                                                    "10px",
                                                  marginTop:
                                                    "5px",
                                                }}
                                              >
                                                <span>
                                                  Pick:{" "}
                                                  <strong>
                                                    {
                                                      game.prediction
                                                    }
                                                  </strong>
                                                </span>

                                                <strong>
                                                  {
                                                    game.points
                                                  }{" "}
                                                  pts
                                                </strong>
                                              </div>

                                              <div
                                                className="muted"
                                                style={{
                                                  fontSize:
                                                    "12px",
                                                  marginTop:
                                                    "4px",
                                                }}
                                              >
                                                Actual:{" "}
                                                {
                                                  game.actual
                                                }
                                              </div>
                                            </div>
                                          );
                                        }
                                      )}
                                    </div>
                                  </details>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPETITION LEADERBOARD */}

      <div className="card">
        <h3
          style={{
            marginBottom: "4px",
          }}
        >
          🏆 Competition Leaderboard
        </h3>

        <p
          className="muted"
          style={{
            marginTop: "0",
            marginBottom: "16px",
          }}
        >
          Competition Points after completed
          rounds.
        </p>

        {/* LEADERBOARD */}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {leaderboard.length === 0 ? (
            <p className="muted">
              No completed rounds yet.
            </p>
          ) : (
            leaderboard.map((player) => (
              <LeaderboardPlayer
                key={player.player_id}
                player={player}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}
