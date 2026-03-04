import { useParams } from "wouter";
import Layout from "@/components/Layout";

export default function ReviewRefine() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Layout projectId={projectId} currentStep={3}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Review &amp; Refine
        </h1>
        <p className="text-muted-foreground">
          Fine-tune every step. See the numbers change in real time.
        </p>
      </div>

      <div className="mt-12 flex items-center justify-center rounded-lg border border-dashed border-border p-12">
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    </Layout>
  );
}
