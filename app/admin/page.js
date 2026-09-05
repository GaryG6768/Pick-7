export const dynamic = "force-dynamic";

export default async function Admin() {
  let message = "Checking database...";

  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );

    const { data, error } = await db
      .from("rounds")
      .select("*")
      .limit(5);

    if (error) {
      message = "Database error: " + error.message;
    } else {
      message = "Database working. Rounds found: " + (data?.length || 0);
    }
  } catch (error) {
    message = "Connection error: " + error.message;
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
