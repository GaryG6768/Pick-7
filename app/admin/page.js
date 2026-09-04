"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [rounds, setRounds] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const db = supabase();

    const roundsResult = await db
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    if (roundsResult.error) {
      setMessage("Rounds: " + roundsResult.error.message);
    } else {
      setRounds(roundsResult.data || []);
    }

    const fixturesResult = await db
      .from("fixtures")
      .select("*")
      .order("kickoff", { ascending: true });

    if (fixturesResult.error) {
      setMessage("Fixtures: " + fixturesResult.error.message);
    } else {
      setFixtures(fixturesResult.data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createRound() {
    setMessage("");

    if (fixtures.length < 7) {
      setMessage("There are fewer than 7 fixtures in the database.");
      return;
    }

    const db = supabase();

    const nextRound =
      rounds.length > 0
        ? Math.max(
            ...rounds.map((r) => Number(r.round_number) || 0)
          ) + 1
        : 1;

    const roundResult = await db
      .from("rounds")
      .
