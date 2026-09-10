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
    // Check once when navigation loads
    checkPicksAccess();

    // Update immediately after sign-in/sign-out
    const handleAuthChanged = () => {
      checkPicksAccess();
    };

    // Activate Picks immediately after all 7
    // picks have been successfully submitted
    const handlePicksSubmitted = () => {
      setCanViewPicks(true);
    };

    const { data: authListener } =
      supabase().auth.onAuthStateChange(
        handleAuthChanged
      );

    window.addEventListener(
      "pick7:auth-changed",
      handleAuthChanged
    );

    window.addEventListener(
      "pick7:picks-submitted",
      handlePicksSubmitted
    );

    return () => {
      window.removeEventListener(
        "pick7:auth-changed",
        handleAuthChanged
      );

      window.removeEventListener(
        "pick7:picks-submitted",
        handlePicksSubmitted
      );

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
