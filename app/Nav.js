"use client";

import Link from "next/link";
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
        .order("round_number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (!round) {
        setCanViewPicks(false);
        return;
      }

      const { data: predictions } =
        await supabase()
          .from("predictions")
          .select("fixture_id")
          .eq("round_id", round.id)
          .eq("player_id", user.id);

      const uniqueFixtures = new Set(
        (predictions || []).map(
          (prediction) => prediction.fixture_id
        )
      );

      setCanViewPicks(
        uniqueFixtures.size === 7
      );
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

    const interval = setInterval(
      checkPicksAccess,
      3000
    );

    const {
      data: authListener,
    } = supabase().auth.onAuthStateChange(
      () => {
        checkPicksAccess();
      }
    );

    return () => {
      clearInterval(interval);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return (
    <nav className="nav">

      <Link href="/">
        ⚽
        <small>Play</small>
      </Link>

      <Link href="/history">
        📜
        <small>History</small>
      </Link>

      <Link href="/competition">
        🏆
        <small>5 Rounds</small>
      </Link>

      <Link href="/season">
        📊
        <small>Season</small>
      </Link>

      {canViewPicks ? (
        <Link href="/players-picks">
          👥
          <small>Picks</small>
        </Link>
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
