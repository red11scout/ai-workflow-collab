import { useParams } from "wouter";
import Layout from "@/components/Layout";

export default function CurrentMapping() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Layout projectId={projectId} currentStep={1}>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Map Current Workflows
        </h1>
        <p className="text-muted-foreground">
          Define how your processes work today. Step by step.
        </p>
      </div>

      <div className="mt-12 flex items-center justify-center rounded-lg border border-dashed border-border p-12">
        <p className="text-muted-foreground">Coming soon</p>
      </div>
    </Layout>
  );
}
