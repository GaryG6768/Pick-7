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

      // Get all Pick 7 rounds
      const {
        data: roundData,
        error: roundError
      } = await db
        .from("rounds")
        .select(
          "id, round_number, status"
        )
        .order("round_number", {
          ascending: true
        });

      if (roundError) {
        throw roundError;
      }

      const roundList = roundData || [];

      setRounds(roundList);

      // Get players who are in the Season League
      const {
        data: profileData,
        error: profileError
      } = await db
        .from("profiles")
        .select(
          "id, display_name, season_league, season_league_start_round"
        )
        .eq("season_league", true)
        .eq("active", true)
        .order("display_name", {
          ascending: true
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
        player => player.id
      );

      // Get their Pick 7 round scores
      const {
        data: scoreData,
        error: scoreError
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
        roundList.map(round => [
          round.id,
          round
        ])
      );

      const leaderboard = profileList.map(
        profile => {
          const roundPoints = {};

          scores
            .filter(
              score =>
                score.player_id ===
                profile.id
            )
            .forEach(score => {
              const round =
                roundMap[score.round_id];

              if (!round) {
                return;
              }

              // Only count points from the
              // round the player joined the
              // Season League.
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

          // Add every eligible round.
          const total =
            Object.values(
              roundPoints
            ).reduce(
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
            total
          };
        }
      );

      // Highest Season total first.
      leaderboard.sort(
        (a, b) =>
          b.total - a.total ||
          a.name.localeCompare(b.name)
      );

      // Assign positions.
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
              position
            };
          }
        );

      setPlayers(positioned);
    } catch (error) {
      setMessage(
        error?.message ||
          "Unable to load the Season League."
      );
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <main className="wrap">

      {/* Header */}
      <div className="card">
        <div className="muted">
          SEASON LEAGUE
        </div>

        <h2>
          Pick 7 Season
        </h2>

        <p className="muted">
          Your Pick 7 points are added
          together throughout the season.
        </p>

        <p className="muted">
          Exact score ={" "}
          <strong>10 points</strong>
          <br />

          Correct result ={" "}
          <strong>6 points</strong>
          <br />

          Wrong result ={" "}
          <strong>0 points</strong>
        </p>

        <p className="muted">
          Your Season total starts from
          the round in which you joined
          the Season League.
        </p>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h3>
          Season Leaderboard
        </h3>

        {players.length === 0 ? (
          <p className="muted">
            No Season League players
            have been added yet.
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
                  <th>
                    Pos
                  </th>

                  <th>
                    Player
                  </th>

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
                {players.map(player => (
                  <tr
                    key={
                      player.player_id
                    }
                  >
                    <td>
                      <strong>
                        {player.position}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {player.name}
                      </strong>
                    </td>

                    {rounds.map(
                      round => (
                        <td
                          key={round.id}
                          className="right"
                        >
                          {
                            player.rounds[
                              round.id
                            ] ?? "–"
                          }
                        </td>
                      )
                    )}

                    <td className="right">
                      <strong>
                        {player.total}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card">
        <h3>
          How the Season Works
        </h3>

        <p className="muted">
          Every Pick 7 round contributes
          your match points to your Season
          League total.
          <br /><br />

          Exact score ={" "}
          <strong>10 points</strong>
          <br />

          Correct result ={" "}
          <strong>6 points</strong>
          <br />

          Wrong result ={" "}
          <strong>0 points</strong>
          <br /><br />

          If you join the Season League
          after the season has started,
          only rounds from your joining
          round onwards count towards your
          Season total.
        </p>
      </div>

    </main>
  );
}
