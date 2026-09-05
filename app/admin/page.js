export const dynamic = "force-dynamic";

export default async function Admin() {
  let message = "Testing Supabase connection...";

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) {
      message = "Environment variables are missing.";
    } else {
      const response = await fetch(
        `${url}/rest/v1/rounds?select=*&limit=5`,
        {
          method: "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
          },
          cache: "no-store",
        }
      );

      const text = await response.text();

      message =
        `Supabase response: ${response.status} ` +
        `${response.statusText}. ` +
        `Data: ${text.substring(0, 200)}`;
    }
  } catch (error) {
    message = "Connection failed: " + error.message;
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
