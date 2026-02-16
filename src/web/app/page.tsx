export default function HomePage() {
  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "2rem",
      gap: "1rem",
    }}>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 700 }}>Bush</h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "1.125rem" }}>
        Creative Collaboration Platform
      </p>
      <div style={{
        marginTop: "2rem",
        padding: "1rem 2rem",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "var(--border-radius)",
        border: "1px solid var(--border-color)",
      }}>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
          Under Construction - Iteration 1
        </p>
      </div>
    </main>
  );
}
