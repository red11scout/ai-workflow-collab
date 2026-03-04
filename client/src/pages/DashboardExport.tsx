import { useParams } from "wouter";
import Layout from "@/components/Layout";

export default function DashboardExport() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Layout projectId={projectId} currentStep={4}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          The complete picture. Export and share.
        </p>
      </div>

      <div className="mt-12 flex items-center justify-center rounded-lg border border-dashed border-border p-12">
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    </Layout>
  );
}
