"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

      const { data: rounds, error: roundsError } = await db
        .from("rounds")
        .select("id, round_number, status")
        .order("round_number", { ascending: false });

      if (roundsError) throw roundsError;

      const { data: scores, error: scoresError } = await db
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

      const roundIds = (rounds || []).map(r => r.id);

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
              .map(x => x.fixture_id)
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

      const fixtureById = Object.fromEntries(
        fixtures.map(f => [f.id, f])
      );

      const scoreByRound = Object.fromEntries(
        (scores || []).map(s => [s.round_id, s])
      );

      const predictionByRound = {};

      (predictions || []).forEach(p => {
        if (!predictionByRound[p.round_id]) {
          predictionByRound[p.round_id] = {};
        }

        predictionByRound[p.round_id][p.fixture_id] = p;
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
            score: scoreByRound[round.id] || null,
            games
          };
        })
        .filter(
          round =>
            round.games.some(game => game.prediction) ||
            round.score
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
          <h2>My History</h2>

          <p className="notice">
            {message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">
          PLAYER HISTORY
        </div>

        <h2>
          My Pick 7 History
        </h2>

        <p className="muted">
          Your previous predictions, scores and
          finishing positions.
        </p>
      </div>

      {history.length === 0 && (
        <div className="card">
          <p className="muted">
            You haven't completed a Pick 7 round yet.
          </p>
        </div>
      )}

      {history.map(round => (
        <div
          className="card"
          key={round.id}
        >

          <div className="muted">
            ROUND {round.round_number} •{" "}
            {String(
              round.status || ""
            ).toUpperCase()}
          </div>

          {round.score ? (
            <>
              <h3>
                {round.score.match_points} MATCH POINTS
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "10px",
                  marginBottom: "18px"
                }}
              >

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.06)",
                    textAlign: "center"
                  }}
                >
                  <div className="muted">
                    COMPETITION
                  </div>

                  <strong>
                    {Number(
                      round.score
                        .competition_points || 0
                    ).toFixed(2)}
                  </strong>
                </div>

                <div
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.06)",
                    textAlign: "center"
                  }}
                >
                  <div className="muted">
                    POSITION
                  </div>

                  <strong>
                    {round.score.position}
                  </strong>
                </div>

              </div>
            </>
          ) : (
            <h3>
              PICKS SUBMITTED
            </h3>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
          >

            {round.games.map(game => {
              const fixture = game.fixture;
              const prediction =
                game.prediction;

              if (!fixture || !prediction) {
                return null;
              }

              return (
                <div
                  key={game.fixture_id}
                  style={{
                    padding: "14px",
                    borderRadius: "12px",
                    background:
                      "rgba(255,255,255,0.045)",
                    border:
                      "1px solid rgba(255,255,255,0.08)"
                  }}
                >

                  <div
                    className="muted"
                    style={{
                      marginBottom: "8px"
                    }}
                  >
                    GAME {game.fixture_number}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "1fr auto 1fr",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >

                    <div
                      style={{
                        fontWeight: "700",
                        textAlign: "left"
                      }}
                    >
                      {fixture.home_team}
                    </div>

                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "900",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {prediction.predicted_home}
                      {" - "}
                      {prediction.predicted_away}
                    </div>

                    <div
                      style={{
                        fontWeight: "700",
                        textAlign: "right"
                      }}
                    >
                      {fixture.away_team}
                    </div>

                  </div>

                  {fixture.result_entered && (
                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop:
                          "1px solid rgba(255,255,255,0.08)",
                        textAlign: "center"
                      }}
                    >
                      <span className="muted">
                        Actual result{" "}
                      </span>

                      <strong>
                        {fixture.home_score}
                        {" - "}
                        {fixture.away_score}
                      </strong>
                    </div>
                  )}

                </div>
              );
            })}

          </div>

        </div>
      ))}

    </main>
  );
}
