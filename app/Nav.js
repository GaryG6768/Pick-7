"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Nav() {
  const [canViewPicks, setCanViewPicks] = useState(false);

  async function checkPicksAccess() {
    try {
      const {
        data: { user },
      } = await supabase().auth.getUser();

      if (!user) {
        setCanViewPicks(false);
        return;
      }

      const { data: round } = await supabase()
        .from("rounds")
        .select("id")
        .eq("status", "open")
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!round) {
        setCanViewPicks(false);
        return;
      }

      const { data: predictions } = await supabase()
        .from("predictions")
        .select("fixture_id")
        .eq("round_id", round.id)
        .eq("player_id", user.id);

      const uniqueFixtures = new Set(
        (predictions || []).map(
          (prediction) => prediction.fixture_id
        )
      );

      setCanViewPicks(uniqueFixtures.size === 7);
    } catch (error) {
      console.error(
        "Could not check Players' Picks access:",
        error
      );

      setCanViewPicks(false);
    }
  }

  useEffect(() => {
    checkPicksAccess();

    const { data: authListener } =
      supabase().auth.onAuthStateChange(() => {
        checkPicksAccess();
      });

    const handleFocus = () => {
      checkPicksAccess();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <nav className="nav">

      <a href="/">
        ⚽
        <small>Play</small>
      </a>

      <a href="/history">
        📜
        <small>History</small>
      </a>

      <a href="/competition">
        🏆
        <small>5 Rounds</small>
      </a>

      <a href="/season">
        📊
        <small>Season</small>
      </a>

      {canViewPicks ? (
        <a href="/players-picks">
          👥
          <small>Picks</small>
        </a>
      ) : (
        <span
          className="nav-disabled"
          aria-disabled="true"
        >
          👥
          <small>Picks</small>
        </span>
      )}

    </nav>
  );
}
