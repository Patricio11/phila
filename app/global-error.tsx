"use client";

/**
 * Root error fallback (replaces the whole document if the root layout itself
 * fails). Minimal and self-contained  it can't rely on the app shell.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center", background: "#f3f5f4", color: "#141916" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em" }}>Phila couldn&apos;t load</h1>
          <p style={{ marginTop: 8, maxWidth: 360, fontSize: 14, color: "#5b635e" }}>
            Something went wrong loading the app. Your data is safe.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 20, height: 44, padding: "0 20px", borderRadius: 9, border: "none", background: "#1C7D58", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
