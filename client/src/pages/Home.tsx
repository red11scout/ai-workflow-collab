import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, FolderOpen, Upload, PenTool } from "lucide-react";

type Project = {
  id: number;
  name: string;
  companyName: string;
  industry: string;
  description?: string;
  status: string;
  createdAt: string;
  workflowCount?: number;
};

type CreateMode = "import" | "manual";

export default function Home() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<CreateMode>("import");
  const [formData, setFormData] = useState({
    name: "",
    companyName: "",
    industry: "",
    description: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { mode: CreateMode }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowForm(false);
      setFormData({ name: "", companyName: "", industry: "", description: "" });
      navigate(`/project/${project.id}/import`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setDeleteConfirm(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.companyName.trim()) return;
    createMutation.mutate({ ...formData, mode });
  }

  function handleDelete(id: number) {
    if (deleteConfirm === id) {
      deleteMutation.mutate(id);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-[#001278] tracking-tight">
            AI Workflow Collaboration
          </h1>
          <p className="mt-2 text-muted-foreground text-lg">
            Map your workflows. See the transformation. Make it real.
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* New Project Toggle */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}

        {/* Inline Create Form */}
        {showForm && (
          <div className="mb-8 p-6 rounded-xl border border-border bg-card shadow-sm">
            {/* Mode Tabs */}
            <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
              <button
                onClick={() => setMode("import")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "import"
                    ? "bg-[#001278] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="w-4 h-4" />
                Import JSON
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  mode === "manual"
                    ? "bg-[#001278] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <PenTool className="w-4 h-4" />
                Create Manually
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Q2 Workflow Analysis"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, companyName: e.target.value }))
                    }
                    placeholder="Acme Corp"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, industry: e.target.value }))
                    }
                    placeholder="Financial Services"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Description{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="Brief context for this engagement."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd] resize-none"
                />
              </div>

              {mode === "manual" && (
                <p className="text-sm text-muted-foreground">
                  You'll define use cases on the next screen.
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Create Project"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ name: "", companyName: "", industry: "", description: "" });
                  }}
                  className="px-4 py-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>

              {createMutation.isError && (
                <p className="text-sm text-destructive">
                  {(createMutation.error as Error).message}
                </p>
              )}
            </form>
          </div>
        )}

        {/* Project List */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            Loading projects...
          </div>
        ) : projects.length === 0 && !showForm ? (
          <div className="text-center py-16">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground text-lg">No projects yet.</p>
            <p className="text-muted-foreground text-sm mt-1">
              Start one. The work matters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative rounded-xl border border-border bg-card p-5 hover:shadow-md hover:border-[#02a2fd]/30 transition-all"
              >
                {/* Card content — clickable area */}
                <button
                  onClick={() => navigate(`/project/${project.id}/import`)}
                  className="w-full text-left"
                >
                  <h3 className="font-semibold text-foreground text-lg leading-tight">
                    {project.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {project.companyName}
                  </p>

                  <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                    {project.industry && (
                      <span className="px-2 py-0.5 rounded-full bg-[#02a2fd]/10 text-[#02a2fd] font-medium">
                        {project.industry}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-[#36bf78]/10 text-[#36bf78] font-medium capitalize">
                      {project.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                    <span>{formatDate(project.createdAt)}</span>
                    {project.workflowCount !== undefined && (
                      <span>
                        {project.workflowCount} workflow
                        {project.workflowCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </button>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id);
                  }}
                  disabled={deleteMutation.isPending}
                  className={`absolute top-3 right-3 p-1.5 rounded-md transition-colors ${
                    deleteConfirm === project.id
                      ? "bg-destructive text-white"
                      : "text-muted-foreground/0 group-hover:text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  }`}
                  title={deleteConfirm === project.id ? "Click again to confirm" : "Delete project"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
