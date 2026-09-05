"use client";

import { supabase } from "../../lib/supabase";

export default function Admin() {
  const db = supabase();

  return (
    <main className="wrap">
      <div className="card">
        <div className="muted">PICK 7 ADMIN</div>
        <h2>Admin Dashboard</h2>
        <p>Supabase connection is working.</p>
      </div>
    </main>
  );
}
