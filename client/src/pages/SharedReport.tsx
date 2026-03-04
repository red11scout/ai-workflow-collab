import { useParams } from "wouter";

export default function SharedReport() {
  const { code } = useParams<{ code: string }>();

  return (
    <div className="min-h-screen bg-background font-sans">
      <main className="mx-auto max-w-7xl px-4 py-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Shared Report</h1>
        </div>

        <div className="mt-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    </div>
  );
}
