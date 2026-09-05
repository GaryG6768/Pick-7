"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [competitions, setCompetitions] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedCompetition, setSelectedCompetition] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [message, setMessage] = useState("Checking admin access...");

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase().auth.getUser();

    if (!user) {
      setMessage("Please sign in as the Pick 7 administrator.");
      return;
    }

    const { data: profile, error } = await supabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (error || !profile?.is_admin) {
      await supabase().auth.signOut();
      setMessage("This account is not authorised as a Pick 7 administrator.");
      return;
    }

    setUser(user);
    loadData();
  }

  async function login() {
    if (!email.trim() || !password) {
      setMessage("Enter your email address and password.");
      return;
    }

    setMessage("Signing in...");

    const { data, error } = await supabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage("Sign-in failed: " + error.message);
      return;
    }

    const { data: profile, error: profileError } = await supabase()
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      await supabase().auth.signOut();
      setUser(null);
      setMessage("This account is not authorised as a Pick 7 administrator.");
      return;
    }

    setUser(data.user);
    setPassword("");
    setMessage("");
    loadData();
  }

  async function logout() {
    await supabase().auth.signOut();
    setUser(null);
    setMessage("Signed out.");
  }

  async function loadData() {
    setMessage("Loading...");

    const { data: comps, error: compError } = await supabase()
      .from("competitions")
      .select("*")
      .order("created_at", { ascending: false });

    if (compError) {
      setMessage("Database error: " + compError.message);
      return;
    }

    const { data: roundData, error: roundError } = await supabase()
      .from("rounds")
      .select("*")
      .order("round_number", { ascending: false });

    if (roundError) {
      setMessage("Database error: " + roundError.message);
      return;
    }

    setCompetitions(comps || []);
    setRounds(roundData || []);

    if (!selectedCompetition && comps?.length) {
      setSelectedCompetition(comps[0].id);
    }

    setMessage("");
  }

  async function createCompetition() {
    if (!competitionName.trim()) {
      setMessage("Enter a competition name.");
      return;
    }

    setMessage("Creating competition...");

    const { data, error } = await supabase()
      .from("competitions")
      .insert({
        name: competitionName.trim(),
        rounds_total: 5,
      })
      .select()
      .single();

    if (error) {
      setMessage("Could not create competition: " + error.message);
      return;
    }

    setCompetitionName("");
    setSelectedCompetition(data.id);
    setMessage("Competition created successfully.");
    loadData();
  }

  async function createRound() {
    if (!selectedCompetition) {
      setMessage("Select a competition first.");
      return;
    }

    setMessage("Creating round...");

    const { error } = await supabase().rpc("create_pick7_round", {
      p_competition_id: selectedCompetition,
    });

    if (error) {
      setMessage("Could not create round: " + error.message);
      return;
    }

    setMessage("Round created successfully.");
    loadData();
  }

  if (!user) {
    return (
      <main className="wrap">
        <div className="card">
          <div className="muted">PICK 7 ADMIN</div>
          <h2>Administrator Sign-in</h2>

          <p>Sign in with your Pick 7 administrator account.</p>

          <input
            type="email"
            placeholder="Admin email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              background: "#07111f",
              color: "white",
              border: "1px solid #42627e",
              borderRadius: 8,
            }}
          />

          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              background: "#07111f",
              color: "white",
              border: "1px solid #42627e",
              borderRadius: 8,
            }}
          />

          <button className="btn" onClick={login}>
            SIGN IN
          </button>

          {message && (
            <div className="notice" style={{ marginTop: 20 }}>
              {message}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>
        <p>Signed in as administrator.</p>

        <button className="btn" onClick={logout}>
          SIGN OUT
        </button>
      </div>

      <div className="card">
        <h3>1. Create Competition</h3>

        <input
          type="text"
          placeholder="Competition name"
          value={competitionName}
          onChange={(e) => setCompetitionName(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 12,
            background: "#07111f",
            color: "white",
            border: "1px solid #42627e",
            borderRadius: 8,
          }}
        />

        <button className="btn" onClick={createCompetition}>
          CREATE 5-ROUND COMPETITION
        </button>
      </div>

      <div className="card">
        <h3>2. Select Competition</h3>

        {competitions.length === 0 ? (
          <p className="muted">No competitions created yet.</p>
        ) : (
          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              background: "#07111f",
              color: "white",
              border: "1px solid #42627e",
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
        )}

        <button
          className="btn"
          onClick={createRound}
          disabled={!selectedCompetition}
        >
          CREATE NEXT ROUND
        </button>

        {message && (
          <div className="notice" style={{ marginTop: 20 }}>
            {message}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Existing Rounds</h3>

        {rounds.length === 0 ? (
          <p className="muted">No rounds have been created yet.</p>
        ) : (
          rounds.map((round) => (
            <div
              key={round.id}
              style={{
                padding: 14,
                marginBottom: 10,
                border: "1px solid #42627e",
                borderRadius: 8,
              }}
            >
              <strong>Round {round.round_number}</strong>
              <br />
              <span className="muted">Status: {round.status}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
