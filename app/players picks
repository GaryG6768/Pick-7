"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function PlayersPicksPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPicks();
  }, []);

  async function loadPicks() {
    setLoading(true);
    setMessage("");

    const {
      data: result,
      error,
    } = await supabase().functions.invoke(
      "players-picks",
      {
        body: {},
      }
    );

    if (error) {
      setMessage(
        error.message ||
          "Unable to load Players' Picks."
      );
      setLoading(false);
      return;
    }

    if (!result?.ok) {
      setMessage(
        result?.error ||
          "Unable to load Players' Picks."
      );
      setLoading(false);
      return;
    }

    setData(result);
    setLoading(false);
  }

  function formatKickoff(kickoff) {
    if (!kickoff) return "";

    return new Date(kickoff).toLocaleString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  if (loading) {
    return (
      <main className="page">
        <section className="card">
          <h1>👥 Players' Picks</h1>
          <p>Loading players' picks...</p>
        </section>
      </main>
    );
  }

  if (message) {
    return (
      <main className="page">
        <section className="card">
          <h1>👥 Players' Picks</h1>

          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 12,
              background: "#162637",
              border: "1px solid #29465e",
              color: "#dce8f2",
            }}
          >
            {message}
          </div>

          <button
            className="btn"
            onClick={loadPicks}
            style={{
              marginTop: 18,
              width: "100%",
            }}
          >
            🔄 TRY AGAIN
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ marginBottom: 4 }}>
              👥 Players' Picks
            </h1>

            <div
              style={{
                color: "#91a8bb",
                fontSize: 14,
              }}
            >
              Round {data.round.round_number}
            </div>
          </div>

          <button
            className="btn"
            onClick={loadPicks}
            style={{
              minWidth: 90,
            }}
          >
            🔄 REFRESH
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background:
              "linear-gradient(180deg,#17364e,#102a3d)",
            border: "1px solid #31536c",
            color: "#dce8f2",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong>
            Submitted players only
          </strong>
          <br />
          Your picks are shown along with every
          other player who has submitted their
          seven picks.
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gap: 16,
          }}
        >
          {data.players.length === 0 ? (
            <div
              style={{
                padding: 18,
                textAlign: "center",
                borderRadius: 12,
                background: "#101d2b",
                border: "1px solid #253d51",
                color: "#9db1c2",
              }}
            >
              No other players have submitted yet.
            </div>
          ) : (
            data.players.map((player) => (
              <div
                key={player.player_id}
                style={{
                  borderRadius: 14,
                  overflow: "hidden",
                  border:
                    "1px solid #29465e",
                  background: "#0d1b29",
                }}
              >
                <div
                  style={{
                    padding: "13px 15px",
                    background:
                      "linear-gradient(180deg,#17364e,#122b3e)",
                    borderBottom:
                      "1px solid #29465e",
                    fontWeight: 900,
                    fontSize: 16,
                  }}
                >
                  {player.display_name}
                </div>

                <div
                  style={{
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {data.fixtures.map(
                    (fixture) => {
                      const pick =
                        player.picks[
                          fixture.id
                        ];

                      return (
                        <div
                          key={fixture.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "30px 1fr auto",
                            gap: 8,
                            alignItems:
                              "center",
                            padding:
                              "10px 8px",
                            borderRadius: 10,
                            background:
                              "#101f2e",
                          }}
                        >
                          <div
                            style={{
                              color: "#7f9ab0",
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            {fixture.fixture_number}
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {fixture.home_team}
                            </div>

                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {fixture.away_team}
                            </div>

                            <div
                              style={{
                                marginTop: 3,
                                color: "#718da3",
                                fontSize: 11,
                              }}
                            >
                              {formatKickoff(
                                fixture.kickoff
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              minWidth: 52,
                              textAlign:
                                "center",
                              fontSize: 20,
                              fontWeight: 900,
                              color:
                                "#ffffff",
                            }}
                          >
                            {pick ? (
                              <>
                                {pick.home}
                                <span
                                  style={{
                                    color:
                                      "#7190a8",
                                    margin:
                                      "0 4px",
                                  }}
                                >
                                  -
                                </span>
                                {pick.away}
                              </>
                            ) : (
                              "-"
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
