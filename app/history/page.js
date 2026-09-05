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
      const db = supabase();

      const { data: userData } = await db.auth.getUser();
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
        .select("round_id, match_points, competition_points, position")
        .eq("player_id", currentUser.id);

      if (scoresError) throw scoresError;

      const { data: predictions, error: predictionsError } = await db
        .from("predictions")
        .select(
          "round_id, fixture_id, predicted_home, predicted_away"
        )
        .eq("player_id", currentUser.id);

      if (predictionsError) throw predictionsError;

      const roundIds = (rounds || []).map(r => r.id);

      let links = [];
      let fixtures = [];

      if (roundIds.length) {
        const { data: linkData, error: linkError } = await db
          .from("round_fixtures")
          .select("round_id, fixture_number, fixture_id")
          .in("round_id", roundIds)
          .order("fixture_number");

        if (linkError) throw linkError;

        links = linkData || [];

        const fixtureIds = [
          ...new Set(links.map(x => x.fixture_id))
        ];

        if (fixtureIds.length) {
          const { data: fixtureData, error: fixtureError } =
            await db
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

      const result = (rounds || []).map(round => ({
        ...round,
        score: scoreByRound[round.id] || null,
        games: (linksByRound[round.id] || []).map(link => ({
          ...link,
          fixture: fixtureById[link.fixture_id],
          prediction:
            predictionByRound[round.id]?.[link.fixture_id]
        }))
      }));

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
          <p className="notice">{message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">PLAYER HISTORY</div>

        <h2>My Pick 7 History</h2>

        <p className="muted">
          Your previous predictions, scores and finishing positions.
        </p>
      </div>

      {history.length === 0 && (
        <div className="card">
          <p className="muted">
            No Pick 7 rounds yet.
          </p>
        </div>
      )}

      {history.map(round => (
        <div className="card" key={round.id}>

          <div className="muted">
            ROUND {round.round_number} •{" "}
            {String(round.status || "").toUpperCase()}
          </div>

          <h3>
            {round.score
              ? `${round.score.match_points} MATCH POINTS`
              : "NOT SCORED YET"}
          </h3>

          {round.score && (
            <p className="muted">
              Competition points:{" "}
              <strong>
                {Number(
                  round.score.competition_points || 0
                ).toFixed(2)}
              </strong>

              <br />

              Finishing position:{" "}
              <strong>{round.score.position}</strong>
            </p>
          )}

          {round.games.map(game => {
            const fixture = game.fixture;
            const prediction = game.prediction;

            if (!fixture) return null;

            return (
              <div
                className="fixture"
                key={game.fixture_id}
              >

                <div className="team">
                  {game.fixture_number}.{" "}
                  {fixture.home_team}
                </div>

                <div className="scoreBox">
                  {prediction
                    ? `${prediction.predicted_home} - ${prediction.predicted_away}`
                    : "—"}
                </div>

                <div className="away">
                  {fixture.away_team}
                </div>

                {fixture.result_entered && (
                  <div
                    className="muted"
                    style={{
                      marginLeft: "auto",
                      whiteSpace: "nowrap"
                    }}
                  >
                    Result {fixture.home_score} -{" "}
                    {fixture.away_score}
                  </div>
                )}

              </div>
            );
          })}

        </div>
      ))}

    </main>
  );
}
