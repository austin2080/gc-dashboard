import DirectoryPageClient from "@/components/directory/directory-page-client";

export default function SubcontractorsPage() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Subs Directory</h1>
        <p className="text-sm opacity-80">
          Find, add, and manage subcontractors by trade. Click any sub to open their full contractor profile.
        </p>
      </header>

      <DirectoryPageClient />
    </main>
  );
}
