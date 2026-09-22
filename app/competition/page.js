"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CompetitionPage() {
  const [competition, setCompetition] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [roundScores, setRoundScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [openRound, setOpenRound] = useState(null);
  const [roundDetails, setRoundDetails] = useState({});
  const [loadingRound, setLoadingRound] = useState(null);

  useEffect(() => {
    loadCompetition();
  }, []);

  async function loadCompetition() {
    try {
      setLoading(true);
      setMessage("");

      const db = supabase();

      /*
       --------------------------------------------------
       GET CURRENT COMPETITION
       --------------------------------------------------
      */

      const {
        data: competitionData,
        error: competitionError
      } = await db
        .from("competitions")
        .select(
          "id, name, rounds_total, current_round, status"
        )
        .order("created_at", {
          ascending: false
        })
        .limit(1)
        .maybeSingle();

      if (competitionError) {
        throw competitionError;
      }

      if (!competitionData) {
        setCompetition(null);
        setRounds([]);
        setRoundScores([]);
        return;
      }

      setCompetition(competitionData);

      /*
       --------------------------------------------------
       GET ROUNDS
       --------------------------------------------------
      */

      const {
        data: roundData,
        error: roundError
      } = await db
        .from("rounds")
        .select(
          "id, round_number, status"
        )
        .eq(
          "competition_id",
          competitionData.id
        )
        .order("round_number", {
          ascending: true
        });

      if (roundError) {
        throw roundError;
      }

      const roundList = roundData || [];

      setRounds(roundList);

      if (roundList.length === 0) {
        setRoundScores([]);
        return;
      }

      /*
       --------------------------------------------------
       GET ROUND SCORES
       --------------------------------------------------
      */

      const roundIds = roundList.map(
        round => round.id
      );

      const {
        data: scoreData,
        error: scoreError
      } = await db
        .from("round_scores")
        .select(
          "round_id, player_id, match_points, competition_points, position, entered"
        )
        .in("round_id", roundIds);

      if (scoreError) {
        throw scoreError;
      }

      setRoundScores(
        scoreData || []
      );
    } catch (error) {
      console.error(
        "Competition loading error:",
        error
      );

      setMessage(
        error?.message ||
          "Unable to load the competition."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   --------------------------------------------------
   LOAD A COMPLETED ROUND
   --------------------------------------------------
  */

  async function loadRoundDetails(
    roundId
  ) {
    if (roundDetails[roundId]) {
      return;
    }

    setLoadingRound(roundId);

    try {
      const {
        data,
        error
      } = await supabase().rpc(
        "get_completed_pick7_round_details",
        {
          p_round_id: roundId
        }
      );

      if (error) {
        throw error;
      }

      const rows = data || [];

      /*
       --------------------------------------------------
       GET TEAM NAMES
       --------------------------------------------------
      */

      const fixtureIds = [
        ...new Set(
          rows
            .map(row => row.fixture_id)
            .filter(Boolean)
        )
      ];

      let fixtures = [];

      if (fixtureIds.length > 0) {
        const {
          data: fixtureData,
          error: fixtureError
        } = await supabase()
          .from("fixtures")
          .select(
            "id, home_team, away_team"
          )
          .in(
            "id",
            fixtureIds
          );

        if (fixtureError) {
          throw fixtureError;
        }

        fixtures = fixtureData || [];
      }

      const fixtureMap =
        Object.fromEntries(
          fixtures.map(
            fixture => [
              fixture.id,
              fixture
            ]
          )
        );

      /*
       Add the team names to every
       completed-game result.
      */

      const enrichedRows =
        rows.map(row => ({
          ...row,

          home_team:
            fixtureMap[
              row.fixture_id
            ]?.home_team || "",

          away_team:
            fixtureMap[
              row.fixture_id
            ]?.away_team || ""
        }));

      setRoundDetails(
        current => ({
          ...current,
          [roundId]:
            enrichedRows
        })
      );
    } catch (error) {
      console.error(
        "Round details error:",
        error
      );

      setMessage(
        "Unable to load round results: " +
          (
            error?.message ||
            "Unknown error"
          )
      );
    } finally {
      setLoadingRound(null);
    }
  }

  /*
   --------------------------------------------------
   OPEN / CLOSE ROUND
   --------------------------------------------------
  */

  async function toggleRound(
    round
  ) {
    if (
      String(
        round.status
      ).toLowerCase() !==
      "completed"
    ) {
      return;
    }

    if (
      openRound === round.id
    ) {
      setOpenRound(null);
      return;
    }

    setOpenRound(round.id);

    await loadRoundDetails(
      round.id
    );
  }

  /*
   --------------------------------------------------
   ROUND STATUS
   --------------------------------------------------
  */

  function roundStatus(
    status
  ) {
    if (!status) {
      return "NOT STARTED";
    }

    return String(
      status
    ).toUpperCase();
  }

  /*
   --------------------------------------------------
   GET ROUND SCORES
   --------------------------------------------------
  */

  function getScoresForRound(
    roundId
  ) {
    return roundScores.filter(
      score =>
        score.round_id ===
        roundId
    );
  }

  /*
   --------------------------------------------------
   BUILD PLAYER RESULTS
   --------------------------------------------------
  */

  function buildPlayerResults(
    details,
    roundId
  ) {
    const players = {};

    details.forEach(row => {
      if (
        !players[
          row.player_id
        ]
      ) {
        players[
          row.player_id
        ] = {
          player_id:
            row.player_id,

          name:
            row.display_name ||
            "Player",

          games: {},

          total: 0
        };
      }

      players[
        row.player_id
      ].games[
        row.fixture_number
      ] = {
        points:
          Number(
            row.points || 0
          ),

        prediction:
          `${row.predicted_home} - ${row.predicted_away}`,

        actual:
          `${row.actual_home} - ${row.actual_away}`,

        home:
          row.actual_home,

        away:
          row.actual_away,

        home_team:
          row.home_team,

        away_team:
          row.away_team
      };

      players[
        row.player_id
      ].total += Number(
        row.points || 0
      );
    });

    /*
     Add competition position
     and competition points.
    */

    const scores =
      getScoresForRound(
        roundId
      );

    Object.values(
      players
    ).forEach(player => {
      const score =
        scores.find(
          item =>
            item.player_id ===
            player.player_id
        );

      if (score) {
        player.competitionPoints =
          Number(
            score.competition_points ||
              0
          );

        player.position =
          score.position;
      } else {
        player.competitionPoints =
          0;

        player.position =
          "-";
      }
    });

    return Object.values(
      players
    ).sort(
      (a, b) =>
        b.total -
          a.total ||
        a.name.localeCompare(
          b.name
        )
    );
  }

  /*
   --------------------------------------------------
   GET FIXTURE RESULTS
   --------------------------------------------------
  */

  function getFixtures(
    details
  ) {
    const fixtures = {};

    details.forEach(row => {
      if (
        !fixtures[
          row.fixture_number
        ]
      ) {
        fixtures[
          row.fixture_number
        ] = {
          fixture_number:
            row.fixture_number,

          fixture_id:
            row.fixture_id,

          actual_home:
            row.actual_home,

          actual_away:
            row.actual_away,

          home_team:
            row.home_team,

          away_team:
            row.away_team
        };
      }
    });

    return Object.values(
      fixtures
    ).sort(
      (a, b) =>
        a.fixture_number -
        b.fixture_number
    );
  }

  /*
   --------------------------------------------------
   LOADING SCREEN
   --------------------------------------------------
  */

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            5 ROUND COMPETITION
          </div>

          <h2>
            5 Rounds
          </h2>

          <p className="muted">
            Loading competition...
          </p>
        </div>
      </main>
    );
  }

  /*
   --------------------------------------------------
   ERROR
   --------------------------------------------------
  */

  if (message) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            5 ROUND COMPETITION
          </div>

          <h2>
            5 Rounds
          </h2>

          <div className="notice">
            {message}
          </div>
        </div>
      </main>
    );
  }

  /*
   --------------------------------------------------
   NO COMPETITION
   --------------------------------------------------
  */

  if (!competition) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            5 ROUND COMPETITION
          </div>

          <h2>
            5 Rounds
          </h2>

          <p className="muted">
            No competition has been
            created yet.
          </p>
        </div>
      </main>
    );
  }

  /*
   --------------------------------------------------
   MAIN PAGE
   --------------------------------------------------
  */

  return (
    <main className="wrap">

      {/* Competition header */}

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

          Each completed round shows
          everyone's results.
        </p>

      </div>

      {/* Competition rounds */}

      <div className="card">

        <h3>
          Competition Rounds
        </h3>

        <div
          style={{
            display: "flex",
            flexDirection:
              "column",
            gap: "10px"
          }}
        >

          {rounds.map(
            round => {

              const completed =
                String(
                  round.status
                ).toLowerCase() ===
                "completed";

              const isOpen =
                openRound ===
                round.id;

              const details =
                roundDetails[
                  round.id
                ] || [];

              const playerResults =
                buildPlayerResults(
                  details,
                  round.id
                );

              const fixtures =
                getFixtures(
                  details
                );

              return (
                <div
                  key={
                    round.id
                  }
                  style={{
                    borderRadius:
                      "12px",

                    background:
                      "rgba(255,255,255,0.05)",

                    border:
                      "1px solid rgba(255,255,255,0.08)",

                    overflow:
                      "hidden"
                  }}
                >

                  {/* Round button */}

                  <button
                    type="button"
                    onClick={() =>
                      toggleRound(
                        round
                      )
                    }
                    disabled={
                      !completed
                    }
                    style={{
                      width: "100%",

                      display:
                        "flex",

                      justifyContent:
                        "space-between",

                      alignItems:
                        "center",

                      padding:
                        "16px",

                      border:
                        "none",

                      background:
                        "transparent",

                      color:
                        "inherit",

                      cursor:
                        completed
                          ? "pointer"
                          : "default",

                      fontSize:
                        "16px"
                    }}
                  >

                    <strong>
                      Round{" "}
                      {
                        round.round_number
                      }
                    </strong>

                    <span
                      style={{
                        display:
                          "flex",

                        alignItems:
                          "center",

                        gap:
                          "10px"
                      }}
                    >

                      <span className="muted">
                        {
                          roundStatus(
                            round.status
                          )
                        }
                      </span>

                      {completed && (
                        <span
                          style={{
                            fontSize:
                              "18px"
                          }}
                        >
                          {isOpen
                            ? "▲"
                            : "▼"}
                        </span>
                      )}

                    </span>

                  </button>

                  {/* Expanded round */}

                  {isOpen && (
                    <div
                      style={{
                        padding:
                          "0 14px 16px 14px",

                        borderTop:
                          "1px solid rgba(255,255,255,0.08)"
                      }}
                    >

                      {loadingRound ===
                        round.id && (
                        <div
                          style={{
                            padding:
                              "18px 0",

                            textAlign:
                              "center"
                          }}
                        >
                          <p className="muted">
                            Loading Round{" "}
                            {
                              round.round_number
                            }{" "}
                            results...
                          </p>
                        </div>
                      )}

                      {loadingRound !==
                        round.id &&
                        details.length ===
                          0 && (
                        <div
                          style={{
                            padding:
                              "18px 0"
                          }}
                        >
                          <p className="muted">
                            No completed
                            results are
                            available yet.
                          </p>
                        </div>
                      )}

                      {loadingRound !==
                        round.id &&
                        details.length >
                          0 && (
                        <>

                          {/* Actual results */}

                          <div
                            style={{
                              marginTop:
                                "14px",

                              marginBottom:
                                "18px"
                            }}
                          >

                            <div
                              className="muted"
                              style={{
                                marginBottom:
                                  "10px"
                              }}
                            >
                              ACTUAL RESULTS
                            </div>

                            <div
                              style={{
                                display:
                                  "grid",

                                gridTemplateColumns:
                                  "repeat(2, minmax(0, 1fr))",

                                gap:
                                  "8px"
                              }}
                            >

                              {fixtures.map(
                                fixture => (
                                  <div
                                    key={
                                      fixture.fixture_number
                                    }
                                    style={{
                                      padding:
                                        "10px",

                                      borderRadius:
                                        "10px",

                                      background:
                                        "rgba(255,255,255,0.04)",

                                      textAlign:
                                        "center"
                                    }}
                                  >

                                    <div
                                      className="muted"
                                      style={{
                                        fontSize:
                                          "12px",

                                        lineHeight:
                                          "1.3"
                                      }}
                                    >
                                      {fixture.home_team}
                                      {" v "}
                                      {fixture.away_team}
                                    </div>

                                    <strong
                                      style={{
                                        fontSize:
                                          "18px"
                                      }}
                                    >
                                      {
                                        fixture.actual_home
                                      }

                                      {" - "}

                                      {
                                        fixture.actual_away
                                      }
                                    </strong>

                                  </div>
                                )
                              )}

                            </div>

                          </div>

                          {/* Player results */}

                          <div
                            className="muted"
                            style={{
                              marginBottom:
                                "10px"
                            }}
                          >
                            PLAYER RESULTS
                          </div>

                          <div
                            style={{
                              overflowX:
                                "auto",

                              WebkitOverflowScrolling:
                                "touch"
                            }}
                          >

                            <table
                              style={{
                                minWidth:
                                  "650px",

                                width:
                                  "100%"
                              }}
                            >

                              <thead>

                                <tr>

                                  <th>
                                    Player
                                  </th>

                                  {[
                                    1,
                                    2,
                                    3,
                                    4,
                                    5,
                                    6,
                                    7
                                  ].map(
                                    number => (
                                      <th
                                        key={
                                          number
                                        }
                                        className="right"
                                      >
                                        G
                                        {
                                          number
                                        }
                                      </th>
                                    )
                                  )}

                                  <th className="right">
                                    Total
                                  </th>

                                </tr>

                              </thead>

                              <tbody>

                                {playerResults.map(
                                  player => (
                                    <tr
                                      key={
                                        player.player_id
                                      }
                                    >

                                      <td>
                                        <strong>
                                          {
                                            player.name
                                          }
                                        </strong>
                                      </td>

                                      {[
                                        1,
                                        2,
                                        3,
                                        4,
                                        5,
                                        6,
                                        7
                                      ].map(
                                        number => {

                                          const game =
                                            player.games[
                                              number
                                            ];

                                          return (
                                            <td
                                              key={
                                                number
                                              }
                                              className="right"
                                            >
                                              {game
                                                ? game.points
                                                : "–"}
                                            </td>
                                          );
                                        }
                                      )}

                                      <td className="right">
                                        <strong>
                                          {
                                            player.total
                                          }
                                        </strong>
                                      </td>

                                    </tr>
                                  )
                                )}

                              </tbody>

                            </table>

                          </div>

                          {/* Detailed predictions */}

                          <div
                            style={{
                              marginTop:
                                "20px"
                            }}
                          >

                            <div
                              className="muted"
                              style={{
                                marginBottom:
                                  "10px"
                              }}
                            >
                              PREDICTIONS
                            </div>

                            {playerResults.map(
                              player => (
                                <details
                                  key={
                                    player.player_id
                                  }
                                  style={{
                                    marginBottom:
                                      "8px",

                                    border:
                                      "1px solid rgba(255,255,255,0.08)",

                                    borderRadius:
                                      "10px",

                                    overflow:
                                      "hidden"
                                  }}
                                >

                                  <summary
                                    style={{
                                      padding:
                                        "13px",

                                      cursor:
                                        "pointer",

                                      fontWeight:
                                        "700",

                                      background:
                                        "rgba(255,255,255,0.04)"
                                    }}
                                  >

                                    {
                                      player.name
                                    }

                                    {" — "}

                                    {
                                      player.total
                                    }

                                    {" MATCH POINTS"}

                                  </summary>

                                  <div
                                    style={{
                                      padding:
                                        "10px"
                                    }}
                                  >

                                    {[
                                      1,
                                      2,
                                      3,
                                      4,
                                      5,
                                      6,
                                      7
                                    ].map(
                                      number => {

                                        const game =
                                          player.games[
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
                                                "10px 4px",

                                              borderBottom:
                                                "1px solid rgba(255,255,255,0.06)"
                                            }}
                                          >

                                            <div
                                              className="muted"
                                              style={{
                                                lineHeight:
                                                  "1.3"
                                              }}
                                            >

                                              {game.home_team}
                                              {" v "}
                                              {game.away_team}

                                            </div>

                                            <div
                                              style={{
                                                display:
                                                  "flex",

                                                justifyContent:
                                                  "space-between",

                                                alignItems:
                                                  "center",

                                                gap:
                                                  "10px",

                                                marginTop:
                                                  "4px"
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
                                                }

                                                {" POINTS"}
                                              </strong>

                                            </div>

                                            <div
                                              className="muted"
                                              style={{
                                                marginTop:
                                                  "4px"
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
                              )
                            )}

                          </div>

                        </>
                      )}

                    </div>
                  )}

                </div>
              );
            }
          )}

          {rounds.length ===
            0 && (
            <p className="muted">
              No rounds have been
              created yet.
            </p>
          )}

        </div>

      </div>

      {/* Leaderboard */}

      <div className="card">

        <h3>
          Competition Leaderboard
        </h3>

        <p className="muted">
          Overall competition points
          after completed rounds.
        </p>

        <div
          style={{
            overflowX:
              "auto"
          }}
        >

          <table>

            <thead>

              <tr>

                <th>
                  Pos
                </th>

                <th>
                  Player
                </th>

                {rounds.map(
                  round => (
                    <th
                      key={
                        round.id
                      }
                      className="right"
                    >
                      R
                      {
                        round.round_number
                      }
                    </th>
                  )
                )}

                <th className="right">
                  Total
                </th>

              </tr>

            </thead>

            <tbody>

              {(() => {

                const playerMap =
                  {};

                roundScores.forEach(
                  score => {

                    if (
                      !playerMap[
                        score.player_id
                      ]
                    ) {
                      playerMap[
                        score.player_id
                      ] = {
                        player_id:
                          score.player_id,

                        total:
                          0,

                        rounds:
                          {}
                      };
                    }

                    const points =
                      Number(
                        score.competition_points ||
                          0
                      );

                    playerMap[
                      score.player_id
                    ].total +=
                      points;

                    playerMap[
                      score.player_id
                    ].rounds[
                      score.round_id
                    ] = points;
                  }
                );

                return Object.values(
                  playerMap
                )
                  .sort(
                    (a, b) =>
                      b.total -
                      a.total
                  )
                  .map(
                    (
                      player,
                      index
                    ) => (
                      <tr
                        key={
                          player.player_id
                        }
                      >

                        <td>
                          {
                            index +
                            1
                          }
                        </td>

                        <td>
                          <strong>
                            Player
                          </strong>
                        </td>

                        {rounds.map(
                          round => (
                            <td
                              key={
                                round.id
                              }
                              className="right"
                            >
                              {
                                player.rounds[
                                  round.id
                                ] ??
                                "–"
                              }
                            </td>
                          )
                        )}

                        <td className="right">
                          <strong>
                            {
                              player.total
                            }
                          </strong>
                        </td>

                      </tr>
                    )
                  );

              })()}

            </tbody>

          </table>

        </div>

      </div>

    </main>
  );
}
