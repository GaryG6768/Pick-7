"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Admin() {
  const [message, setMessage] = useState("Checking database...");

  useEffect(() => {
    checkDatabase();
  }, []);

  async function checkDatabase() {
    const db = supabase();

    const { data, error } = await db
      .from("rounds")
      .select("*")
      .limit(5);

    if (error) {
      setMessage("Database error: " + error.message);
    } else {
      setMessage(
        "Database working. Rounds found: " + (data?.length || 0)
      );
    }
  }

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>
        <p>{message}</p>
      </div>
    </main>
  );
}
