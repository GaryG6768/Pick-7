"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function CompetitionPage() {
  const [competition, setCompetition] = useState(null);
  const [rows, setRows] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { loadCompetition(); }, []);

  async function loadCompetition() {
    setLoading(true);
    const db = supabase();

    const { data: comp, error: compError } = await db
      .from("competitions")
      .select("id,name,rounds_total,current_round,status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (compError) {
      setMessage(compError.message);
      setLoading(false);
      return;
    }

    setCompetition(comp);

    if (!comp) {
      setLoading(false);
      return;
    }

    const { data: roundData, error: roundError } = await db
      .from("rounds")
      .select("id,round_number,status")
      .eq("competition_id", comp.id)
      .order("round_number", { ascending: true });

    if (roundError) {
      setMessage(roundError.message);
      setLoading(false);
      return;
    }

    setRounds(roundData || []);

    const roundIds = (roundData || []).map(r => r.id);

    if (!roundIds.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: scores, error: scoreError } = await db
      .from("round_scores")
      .select(
        "round_id,player_id,match_points,competition_points,position,entered"
      )
      .in("round_id", roundIds);

    if (scoreError) {
      setMessage(scoreError.message);
      setLoading(false);
      return;
    }

    const playerIds = [...new Set((scores || []).map(s => s.player_id))];

    let profiles = [];

    if (playerIds.length) {
      const { data: profileData, error: profileError } = await db
        .from("profiles")
        .select("id,display_name")
        .in("id", playerIds);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      profiles = profileData || [];
    }

    const names = Object.fromEntries(
      profiles.map(p => [p.id, p.display_name || "Player"])
    );

    const totals = {};

    for (const score of scores || []) {
      if (!totals[score.player_id]) {
        totals[score.player_id] = {
          player_id: score.player_id,
          name: names[score.player_id] || "Player",
          total: 0,
          rounds: {}
        };
      }

      totals[score.player_id].total +=
        Number(score.competition_points || 0);

      totals[score.player_id].rounds[score.round_id] =
        Number(score.competition_points || 0);
    }

    setRows(
      Object.values(totals).sort(
        (a, b) =>
          b.total - a.total ||
          a.name.localeCompare(b.name)
      )
    );

    setLoading(false);
  }

  return (
    <main className="wrap">

      <div className="card">
        <div className="muted">5 ROUND COMPETITION</div>

        <h2>
          {competition?.name || "Pick 7 Competition"}
        </h2>

        <p className="muted">
          Weekly points: 1st 10 • 2nd 7 • 3rd 5 • 4th 3 • 5th 2 • 6th 1
        </p>
      </div>

      {loading && (
        <div className="card">
          Loading competition table…
        </div>
      )}

      {!loading && message && (
        <div className="card">
          <div className="notice">
            {message}
          </div>
        </div>
      )}

      {!loading && !message && rounds.length === 0 && (
        <div className="card">
          <h3>No rounds yet</h3>

          <p className="muted">
            The table will appear when rounds are scored.
          </p>
        </div>
      )}

      {!loading && !message && rounds.length > 0 && (
        <div className="card">

          <h3>Competition Leaderboard</h3>

          <div style={{ overflowX: "auto" }}>

            <table>

              <thead>

                <tr>
                  <th>Pos</th>
                  <th>Player</th>

                  {rounds.map(r => (
                    <th key={r.id} className="right">
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

                    {rounds.map(r => (

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

          {rows.length === 0 && (
            <p className="muted">
              No scored players yet.
            </p>
          )}

        </div>
      )}

      <div className="card">

        <h3>How it works</h3>

        <p className="muted">
          Your weekly Pick 7 finishing position earns
          competition points. The player with the most
          competition points after 5 rounds wins.
        </p>

        <Link className="btn" href="/">
          MAKE YOUR PICKS
        </Link>

      </div>

    </main>
  );
}
