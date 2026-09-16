"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CompetitionPage() {
  const [competition, setCompetition] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCompetition();
  }, []);

  async function loadCompetition() {
    try {
      setLoading(true);
      setMessage("");

      const db = supabase();

      // Get the current competition
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
        setPlayers([]);
        return;
      }

      setCompetition(competitionData);

      // Get the rounds belonging to this competition
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
        setPlayers([]);
        return;
      }

      const roundIds = roundList.map(
        round => round.id
      );

      // Get all competition scores
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

      const scores = scoreData || [];

      if (scores.length === 0) {
        setPlayers([]);
        return;
      }

      // Get player names
      const playerIds = [
        ...new Set(
          scores.map(score => score.player_id)
        )
      ];

      const {
        data: profileData,
        error: profileError
      } = await db
        .from("profiles")
        .select(
          "id, display_name"
        )
        .in("id", playerIds);

      if (profileError) {
        throw profileError;
      }

      const names = Object.fromEntries(
        (profileData || []).map(profile => [
          profile.id,
          profile.display_name || "Player"
        ])
      );

      // Build leaderboard
      const playerMap = {};

      scores.forEach(score => {
        if (!playerMap[score.player_id]) {
          playerMap[score.player_id] = {
            player_id: score.player_id,
            name:
              names[score.player_id] ||
              "Player",
            total: 0,
            rounds: {}
          };
        }

        const points = Number(
          score.competition_points || 0
        );

        playerMap[
          score.player_id
        ].total += points;

        playerMap[
          score.player_id
        ].rounds[score.round_id] = points;
      });

      const leaderboard = Object.values(
        playerMap
      ).sort(
        (a, b) =>
          b.total - a.total ||
          a.name.localeCompare(b.name)
      );

      setPlayers(leaderboard);
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to load the competition."
      );
    } finally {
      setLoading(false);
    }
  }

  function roundStatus(status) {
    if (!status) {
      return "NOT STARTED";
    }

    return String(status).toUpperCase();
  }

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
          <br /><br />

          Each round has its own finishing
          position and competition points.
        </p>
      </div>

      {/* Round status */}
      <div className="card">
        <h3>
          Competition Rounds
        </h3>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}
        >
          {rounds.map(round => (
            <div
              key={round.id}
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                padding: "14px",
                borderRadius: "12px",
                background:
                  "rgba(255,255,255,0.05)",
                border:
                  "1px solid rgba(255,255,255,0.08)"
              }}
            >
              <strong>
                Round {round.round_number}
              </strong>

              <span className="muted">
                {roundStatus(
                  round.status
                )}
              </span>
            </div>
          ))}

          {rounds.length === 0 && (
            <p className="muted">
              No rounds have been created yet.
            </p>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h3>
          Competition Leaderboard
        </h3>

        {players.length === 0 ? (
          <p className="muted">
            No competition points have
            been recorded yet.
          </p>
        ) : (
          <div
            style={{
              overflowX: "auto"
            }}
          >
            <table>
              <thead>
                <tr>
                  <th>Pos</th>

                  <th>Player</th>

                  {rounds.map(round => (
                    <th
                      key={round.id}
                      className="right"
                    >
                      R{round.round_number}
                    </th>
                  ))}

                  <th className="right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {players.map(
                  (player, index) => (
                    <tr
                      key={
                        player.player_id
                      }
                    >
                      <td>
                        {index + 1}
                      </td>

                      <td>
                        <strong>
                          {player.name}
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
                            {player.rounds[
                              round.id
                            ] ?? "–"}
                          </td>
                        )
                      )}

                      <td className="right">
                        <strong>
                          {player.total}
                        </strong>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scoring explanation */}
      <div className="card">
        <h3>
          How Competition Points Work
        </h3>

        <p className="muted">
          Your Pick 7 match points determine
          your finishing position in each
          round.
          <br /><br />

          Competition points are then awarded
          according to the number of players
          who entered that round.
          <br /><br />

          For example, with 20 players:
          <br /><br />

          1st = 20 points
          <br />
          2nd = 19 points
          <br />
          3rd = 18 points
          <br />
          4th = 17 points
          <br />
          ...
          <br />
          20th = 1 point.
          <br /><br />

          Tied players share the points for
          the positions they occupy.
        </p>
      </div>

    </main>
  );
}
