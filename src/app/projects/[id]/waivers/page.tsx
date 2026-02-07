export default async function ProjectLienWaiversPage() {
  return (
    <main className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Lien Waivers</h1>
        <p className="text-sm text-[color:var(--muted,#65758b)]">
          Track waiver status and compliance for this project.
        </p>
      </header>

      <section className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/70">
        Waiver records for this project will appear here.
      </section>
    </main>
  );
}
