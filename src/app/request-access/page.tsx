export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-[color:var(--background)] p-6">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-black/10 bg-white p-8 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-[color:var(--muted)]">
          Access Restricted
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Request Project Management Access</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Your account is currently limited to WaiverDesk. If you need access to the
          Project Management app, contact your administrator.
        </p>
        <div className="mt-6 rounded-md border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 px-4 py-3 text-sm text-[color:var(--warning)]">
          Access request flow will be added later.
        </div>
      </div>
    </main>
  );
}
