"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SeasonPage() {
  const [rows, setRows] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSeason();
  }, []);

  async function loadSeason() {
    setLoading(true);
    setMessage("");

    const db = supabase();

    const { data: roundData, error: roundError } = await db
      .from("rounds")
      .select("id,round_number,status")
      .order("round_number", { ascending: true });

    if (roundError) {
      setMessage(roundError.message);
      setLoading(false);
      return;
    }

    setRounds(roundData || []);

    const roundIds = (roundData || []).map(r => r.id);

    if (!roundIds.length) {
      setLoading(false);
      return;
    }

    const { data: scores, error: scoreError } = await db
      .from("round_scores")
      .select("round_id,player_id,match_points,position,entered")
      .in("round_id", roundIds);

    if (scoreError) {
      setMessage(scoreError.message);
      setLoading(false);
      return;
    }

    const playerIds = [
      ...new Set((scores || []).map(s => s.player_id))
    ];

    let profiles = [];

    if (playerIds.length) {
      const { data: profileData, error: profileError } = await db
        .from("profiles")
        .select(
          "id,display_name,season_league,season_league_start_round"
        )
        .in("id", playerIds);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      profiles = profileData || [];
    }

    const profileMap = Object.fromEntries(
      profiles.map(p => [p.id, p])
    );

    const totals = {};

    for (const score of scores || []) {
      const profile = profileMap[score.player_id];

      if (!profile?.season_league) continue;

      const round = (roundData || []).find(
        r => r.id === score.round_id
      );

      if (!round) continue;

      const startRound = profile.season_league_start_round;

      if (
        startRound !== null &&
        startRound !== undefined &&
        round.round_number < startRound
      ) {
        continue;
      }

      if (!totals[score.player_id]) {
        totals[score.player_id] = {
          player_id: score.player_id,
          name: profile.display_name || "Player",
          total: 0,
          rounds: {}
        };
      }

      totals[score.player_id].total +=
        Number(score.match_points || 0);

      totals[score.player_id].rounds[score.round_id] =
        Number(score.match_points || 0);
    }

    const leaderboard = Object.values(totals).sort(
      (a, b) =>
        b.total - a.total ||
        a.name.localeCompare(b.name)
    );

    setRows(leaderboard);
    setLoading(false);
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">SEASON LEAGUE</div>

        <h2>Pick 7 Season</h2>

        <p className="muted">
          Only players who have joined the Season League are shown.
          Points count from the round they joined.
        </p>

        <p className="muted">
          Exact score = 10 points • Correct result = 6 points • Wrong = 0
        </p>
      </div>

      {loading && (
        <div className="card">
          Loading season table…
        </div>
      )}

      {!loading && message && (
        <div className="card">
          <div className="notice">{message}</div>
        </div>
      )}

      {!loading && !message && rows.length === 0 && (
        <div className="card">
          <h3>No season scores yet</h3>

          <p className="muted">
            The Season League table will appear after a round has been scored.
          </p>
        </div>
      )}

      {!loading && !message && rows.length > 0 && (
        <div className="card">

          <h3>Season Leaderboard</h3>

          <div style={{ overflowX: "auto" }}>

            <table>

              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Player</th>

                  {(roundData || []).map(r => (
                    <th
                      key={r.id}
                      className="right"
                    >
                      R{r.round_number}
                    </th>
                  ))}

                  <th className="right">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>

                {rows.map((row, index) => (
                  <tr key={row.player_id}>

                    <td>
                      {index + 1}
                    </td>

                    <td>
                      <strong>
                        {row.name}
                      </strong>
                    </td>

                    {(roundData || []).map(r => (
                      <td
                        key={r.id}
                        className="right"
                      >
                        {row.rounds[r.id] ?? "–"}
                      </td>
                    ))}

                    <td className="right">
                      <strong>
                        {row.total}
                      </strong>
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>

          </div>

        </div>
      )}

    </main>
  );
}
