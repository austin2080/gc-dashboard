import DirectoryPageClient from "@/components/directory/directory-page-client";

export default function DirectoryPage() {
  return (
    <main className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Directory</h1>
        <p className="text-sm opacity-80">
          Manage company and contractor records used across lien waiver tracking workflows.
        </p>
      </header>

      <DirectoryPageClient />
    </main>
  );
}
