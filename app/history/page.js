"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function getResultType(predHome, predAway, actualHome, actualAway) {
  if (
    Number(predHome) === Number(actualHome) &&
    Number(predAway) === Number(actualAway)
  ) {
    return "score";
  }

  const predictedResult =
    Number(predHome) > Number(predAway)
      ? "home"
      : Number(predHome) < Number(predAway)
      ? "away"
      : "draw";

  const actualResult =
    Number(actualHome) > Number(actualAway)
      ? "home"
      : Number(actualHome) < Number(actualAway)
      ? "away"
      : "draw";

  return predictedResult === actualResult ? "result" : "wrong";
}

function getPoints(predHome, predAway, actualHome, actualAway) {
  const type = getResultType(
    predHome,
    predAway,
    actualHome,
    actualAway
  );

  if (type === "score") return 10;
  if (type === "result") return 6;
  return 0;
}

function getPointLabel(points) {
  if (points === 10) return "CORRECT SCORE";
  if (points === 6) return "CORRECT RESULT";
  if (points === 0) return "WRONG RESULT";
  return "";
}

export default function HistoryPage() {
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);
      setMessage("");

      const db = supabase();

      const { data: userData, error: userError } =
        await db.auth.getUser();

      if (userError) throw userError;

      const currentUser = userData?.user;

      if (!currentUser) {
        setMessage("Please sign in to view your history.");
        setLoading(false);
        return;
      }

      setUser(currentUser);

      const { data: rounds, error: roundsError } =
        await db
          .from("rounds")
          .select(
            "id, competition_id, round_number, status, created_at"
          )
          .order("created_at", {
            ascending: false
          });

      if (roundsError) throw roundsError;

      const { data: scores, error: scoresError } =
        await db
          .from("round_scores")
          .select(
            "round_id, match_points, competition_points, position"
          )
          .eq("player_id", currentUser.id);

      if (scoresError) throw scoresError;

      const { data: predictions, error: predictionsError } =
        await db
          .from("predictions")
          .select(
            "round_id, fixture_id, predicted_home, predicted_away"
          )
          .eq("player_id", currentUser.id);

      if (predictionsError) throw predictionsError;

      const roundIds = (rounds || []).map(
        round => round.id
      );

      let links = [];
      let fixtures = [];

      if (roundIds.length > 0) {
        const { data: linkData, error: linkError } =
          await db
            .from("round_fixtures")
            .select(
              "round_id, fixture_number, fixture_id"
            )
            .in("round_id", roundIds)
            .order("fixture_number", {
              ascending: true
            });

        if (linkError) throw linkError;

        links = linkData || [];

        const fixtureIds = [
          ...new Set(
            links
              .map(item => item.fixture_id)
              .filter(Boolean)
          )
        ];

        if (fixtureIds.length > 0) {
          const {
            data: fixtureData,
            error: fixtureError
          } = await db
            .from("fixtures")
            .select(
              "id, home_team, away_team, kickoff, home_score, away_score, result_entered"
            )
            .in("id", fixtureIds);

          if (fixtureError) throw fixtureError;

          fixtures = fixtureData || [];
        }
      }

      const competitionIds = [
        ...new Set(
          (rounds || [])
            .map(round => round.competition_id)
            .filter(Boolean)
        )
      ];

      let competitions = [];

      if (competitionIds.length > 0) {
        const {
          data: competitionData,
          error: competitionError
        } = await db
          .from("competitions")
          .select(
            "id, name, rounds_total, status"
          )
          .in("id", competitionIds);

        if (competitionError) throw competitionError;

        competitions = competitionData || [];
      }

      const fixtureById = Object.fromEntries(
        fixtures.map(fixture => [
          fixture.id,
          fixture
        ])
      );

      const competitionById = Object.fromEntries(
        competitions.map(competition => [
          competition.id,
          competition
        ])
      );

      const scoreByRound = Object.fromEntries(
        (scores || []).map(score => [
          score.round_id,
          score
        ])
      );

      const predictionByRound = {};

      (predictions || []).forEach(prediction => {
        if (!predictionByRound[prediction.round_id]) {
          predictionByRound[prediction.round_id] = {};
        }

        predictionByRound[prediction.round_id][
          prediction.fixture_id
        ] = prediction;
      });

      const linksByRound = {};

      links.forEach(link => {
        if (!linksByRound[link.round_id]) {
          linksByRound[link.round_id] = [];
        }

        linksByRound[link.round_id].push(link);
      });

      const result = (rounds || [])
        .map(round => {
          const games = (
            linksByRound[round.id] || []
          ).map(link => ({
            ...link,
            fixture: fixtureById[link.fixture_id],
            prediction:
              predictionByRound[round.id]?.[
                link.fixture_id
              ]
          }));

          return {
            ...round,
            competition:
              competitionById[round.competition_id] ||
              null,
            score:
              scoreByRound[round.id] || null,
            games
          };
        })
        .filter(round =>
          round.games.some(
            game => game.prediction
          ) || round.score
        );

      setHistory(result);
    } catch (error) {
      setMessage(
        "Unable to load history: " +
          (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="wrap">
        <div className="card">
          <p className="muted">
            Loading your Pick 7 history...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">
            PICK 7 HISTORY
          </div>

          <h2>
            My History
          </h2>

          <p className="notice">
            {message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">

      <div className="card history-header">

        <div className="history-kicker">
          📜 PLAYER HISTORY
        </div>

        <h2>
          My Pick 7 History
        </h2>

        <p className="muted">
          Your predictions, results and points
          from previous rounds.
        </p>

      </div>

      {history.length === 0 && (
        <div className="card">
          <div className="empty-history">
            <div className="empty-history-icon">
              📋
            </div>

            <h3>
              No completed rounds yet
            </h3>

            <p className="muted">
              Your Pick 7 results will appear here
              once you have entered a round.
            </p>
          </div>
        </div>
      )}

      {history.map(round => {

        const completedGames =
          round.games.filter(
            game =>
              game.fixture &&
              game.prediction &&
              game.fixture.result_entered
          );

        const calculatedPoints =
          completedGames.reduce(
            (total, game) =>
              total +
              getPoints(
                game.prediction.predicted_home,
                game.prediction.predicted_away,
                game.fixture.home_score,
                game.fixture.away_score
              ),
            0
          );

        const displayPoints =
          round.score?.match_points ??
          calculatedPoints;

        return (
          <div
            className="card history-round"
            key={round.id}
          >

            <div className="history-round-top">

              <div>
                <div className="history-kicker">
                  {round.competition?.name ||
                    "PICK 7"}
                </div>

                <h3>
                  ROUND {round.round_number}
                </h3>
              </div>

              <div className="history-status">
                {String(
                  round.status || "SUBMITTED"
                ).toUpperCase()}
              </div>

            </div>

            <div className="history-summary">

              <div className="history-stat history-stat-main">
                <div className="history-stat-label">
                  MATCH POINTS
                </div>

                <div className="history-stat-value">
                  {displayPoints}
                  <span>/70</span>
                </div>
              </div>

              <div className="history-stat">
                <div className="history-stat-label">
                  COMPETITION
                </div>

                <div className="history-stat-value small">
                  {round.score
                    ? Number(
                        round.score
                          .competition_points || 0
                      ).toFixed(2)
                    : "—"}
                </div>
              </div>

              <div className="history-stat">
                <div className="history-stat-label">
                  POSITION
                </div>

                <div className="history-stat-value small">
                  {round.score?.position || "—"}
                </div>
              </div>

            </div>

            <div className="history-games">

              {round.games.map(game => {

                const fixture = game.fixture;
                const prediction =
                  game.prediction;

                if (!fixture || !prediction) {
                  return null;
                }

                let points = null;
                let label = "";

                if (
                  fixture.result_entered &&
                  fixture.home_score !== null &&
                  fixture.away_score !== null
                ) {
                  points = getPoints(
                    prediction.predicted_home,
                    prediction.predicted_away,
                    fixture.home_score,
                    fixture.away_score
                  );

                  label = getPointLabel(points);
                }

                return (
                  <div
                    className="history-game"
                    key={game.fixture_id}
                  >

                    <div className="history-game-header">

                      <span>
                        GAME {game.fixture_number}
                      </span>

                      {points !== null && (
                        <span
                          className={
                            points === 10
                              ? "history-points ten"
                              : points === 6
                              ? "history-points six"
                              : "history-points zero"
                          }
                        >
                          {points} POINTS
                        </span>
                      )}

                    </div>

                    <div className="history-teams">

                      <div className="history-team home">
                        {fixture.home_team}
                      </div>

                      <div className="history-score-block">

                        <div className="history-prediction">
                          {prediction.predicted_home}
                          {" - "}
                          {prediction.predicted_away}
                        </div>

                        {fixture.result_entered ? (
                          <div className="history-actual">
                            {fixture.home_score}
                            {" - "}
                            {fixture.away_score}
                          </div>
                        ) : (
                          <div className="history-pending">
                            RESULT PENDING
                          </div>
                        )}

                      </div>

                      <div className="history-team away">
                        {fixture.away_team}
                      </div>

                    </div>

                    <div className="history-result-label">

                      {points !== null ? (
                        <>
                          <span>
                            {label}
                          </span>

                          <span className="history-divider">
                            •
                          </span>

                          <span>
                            YOU PREDICTED
                          </span>
                        </>
                      ) : (
                        <span>
                          AWAITING FINAL RESULT
                        </span>
                      )}

                    </div>

                  </div>
                );
              })}

            </div>

          </div>
        );
      })}

    </main>
  );
}
