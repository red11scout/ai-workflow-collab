import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/Layout";
import {
  Upload,
  PenTool,
  FileJson,
  CheckSquare,
  Square,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

type UseCase = {
  id?: string;
  name: string;
  description: string;
  businessFunction?: string;
  strategicTheme?: string;
  targetFriction?: string;
  desiredOutcomes?: string[];
  selected?: boolean;
};

type WorkforceParams = {
  avgHourlyRate: number;
  annualRevenue: number;
  headcount: number;
  adoptionRate: number;
  dataMaturity: number;
};

type TabMode = "import" | "manual";

const defaultWorkforceParams: WorkforceParams = {
  avgHourlyRate: 45,
  annualRevenue: 50000000,
  headcount: 500,
  adoptionRate: 70,
  dataMaturity: 60,
};

export default function ImportSelect() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabMode>("import");
  const [importedUseCases, setImportedUseCases] = useState<UseCase[]>([]);
  const [manualUseCases, setManualUseCases] = useState<UseCase[]>([]);
  const [workforceParams, setWorkforceParams] = useState<WorkforceParams>(defaultWorkforceParams);
  const [dragOver, setDragOver] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Manual entry form state
  const [manualForm, setManualForm] = useState({
    name: "",
    description: "",
    businessFunction: "",
    targetFriction: "",
    outcomeInput: "",
    desiredOutcomes: [] as string[],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: project } = useQuery<any>({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  const importMutation = useMutation({
    mutationFn: async (rawJson: unknown) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/import`, {
        rawJson,
      });
      return res.json();
    },
    onSuccess: (data: { useCases: UseCase[] }) => {
      const useCases = (data.useCases || []).map((uc: UseCase) => ({
        ...uc,
        selected: true,
      }));
      setImportedUseCases(useCases);
      setImportError(null);
    },
    onError: (err: Error) => {
      setImportError(err.message);
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (payload: {
      useCases: UseCase[];
      workforceParams: WorkforceParams;
    }) => {
      await apiRequest("PUT", `/api/projects/${projectId}`, {
        workforceParams: payload.workforceParams,
      });
      await apiRequest("PUT", `/api/projects/${projectId}/select-usecases`, {
        useCases: payload.useCases,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      navigate(`/project/${projectId}/mapping`);
    },
  });

  // --- Drag and drop ---

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [],
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, []);

  function processFile(file: File) {
    if (!file.name.endsWith(".json")) {
      setImportError("Only JSON files are accepted.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        importMutation.mutate(parsed);
      } catch {
        setImportError("Invalid JSON. Check the file and try again.");
      }
    };
    reader.readAsText(file);
  }

  // --- Selection ---

  function toggleUseCase(index: number) {
    setImportedUseCases((prev) =>
      prev.map((uc, i) =>
        i === index ? { ...uc, selected: !uc.selected } : uc,
      ),
    );
  }

  function selectAll() {
    setImportedUseCases((prev) => prev.map((uc) => ({ ...uc, selected: true })));
  }

  function deselectAll() {
    setImportedUseCases((prev) => prev.map((uc) => ({ ...uc, selected: false })));
  }

  // --- Manual entry ---

  function addOutcome() {
    const val = manualForm.outcomeInput.trim();
    if (!val) return;
    setManualForm((f) => ({
      ...f,
      desiredOutcomes: [...f.desiredOutcomes, val],
      outcomeInput: "",
    }));
  }

  function removeOutcome(index: number) {
    setManualForm((f) => ({
      ...f,
      desiredOutcomes: f.desiredOutcomes.filter((_, i) => i !== index),
    }));
  }

  function handleAddManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.name.trim()) return;

    const newUseCase: UseCase = {
      name: manualForm.name.trim(),
      description: manualForm.description.trim(),
      businessFunction: manualForm.businessFunction.trim(),
      targetFriction: manualForm.targetFriction.trim(),
      desiredOutcomes: manualForm.desiredOutcomes,
      selected: true,
    };

    if (editingIndex !== null) {
      setManualUseCases((prev) =>
        prev.map((uc, i) => (i === editingIndex ? newUseCase : uc)),
      );
      setEditingIndex(null);
    } else {
      setManualUseCases((prev) => [...prev, newUseCase]);
    }

    setManualForm({
      name: "",
      description: "",
      businessFunction: "",
      targetFriction: "",
      outcomeInput: "",
      desiredOutcomes: [],
    });
  }

  function editManualUseCase(index: number) {
    const uc = manualUseCases[index];
    setManualForm({
      name: uc.name,
      description: uc.description,
      businessFunction: uc.businessFunction || "",
      targetFriction: uc.targetFriction || "",
      outcomeInput: "",
      desiredOutcomes: uc.desiredOutcomes || [],
    });
    setEditingIndex(index);
  }

  function deleteManualUseCase(index: number) {
    setManualUseCases((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setManualForm({
        name: "",
        description: "",
        businessFunction: "",
        targetFriction: "",
        outcomeInput: "",
        desiredOutcomes: [],
      });
    }
  }

  // --- Continue ---

  function getSelectedUseCases(): UseCase[] {
    if (tab === "import") {
      return importedUseCases.filter((uc) => uc.selected);
    }
    return manualUseCases;
  }

  function handleContinue() {
    const selected = getSelectedUseCases();
    if (selected.length === 0) return;
    selectMutation.mutate({ useCases: selected, workforceParams });
  }

  const selectedCount = getSelectedUseCases().length;
  const totalImported = importedUseCases.length;
  const importSelectedCount = importedUseCases.filter((uc) => uc.selected).length;

  return (
    <Layout projectId={projectId!} currentStep={0}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Start with what you know.
          </h2>
          <p className="text-muted-foreground mt-1">
            Import from an assessment or build from scratch. Either way, the work begins here.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setTab("import")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "import"
                ? "bg-[#001278] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "manual"
                ? "bg-[#001278] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenTool className="w-4 h-4" />
            Manual Entry
          </button>
        </div>

        {/* ===== Import JSON Tab ===== */}
        {tab === "import" && (
          <div className="space-y-6">
            {/* Drop zone */}
            {importedUseCases.length === 0 && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-[#02a2fd] bg-[#02a2fd]/5"
                    : "border-border hover:border-[#02a2fd]/40 hover:bg-muted/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileJson className="w-12 h-12 mx-auto text-[#02a2fd]/60 mb-4" />
                <p className="text-foreground font-medium text-lg">
                  Drop your JSON file here
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Or click to browse. Export from discover.movefasterwithai.com.
                </p>
                {importMutation.isPending && (
                  <p className="text-[#02a2fd] text-sm mt-3 font-medium">
                    Processing...
                  </p>
                )}
              </div>
            )}

            {importError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {importError}
              </div>
            )}

            {/* Use case selection grid */}
            {importedUseCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {importSelectedCount} of {totalImported} selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs px-3 py-1.5 rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="text-xs px-3 py-1.5 rounded-md bg-muted text-foreground hover:bg-muted/80 transition-colors font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {importedUseCases.map((uc, i) => (
                    <button
                      key={i}
                      onClick={() => toggleUseCase(i)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        uc.selected
                          ? "border-[#02a2fd] bg-[#02a2fd]/5 shadow-sm"
                          : "border-border bg-card hover:border-border/80"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {uc.selected ? (
                          <CheckSquare className="w-5 h-5 text-[#02a2fd] shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm leading-tight">
                            {uc.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {uc.businessFunction && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#001278]/10 text-[#001278]">
                                {uc.businessFunction}
                              </span>
                            )}
                            {uc.strategicTheme && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#36bf78]/10 text-[#36bf78]">
                                {uc.strategicTheme}
                              </span>
                            )}
                          </div>
                          {uc.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {uc.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Manual Entry Tab ===== */}
        {tab === "manual" && (
          <div className="space-y-6">
            {/* Manual add form */}
            <form
              onSubmit={handleAddManual}
              className="p-5 rounded-xl border border-border bg-card space-y-4"
            >
              <h3 className="text-sm font-semibold text-foreground">
                {editingIndex !== null ? "Edit Use Case" : "Add a Use Case"}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={manualForm.name}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Automated Invoice Processing"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Business Function
                  </label>
                  <input
                    type="text"
                    value={manualForm.businessFunction}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, businessFunction: e.target.value }))
                    }
                    placeholder="Finance"
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="What does this workflow do today? Where does it hurt?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Target Friction
                </label>
                <input
                  type="text"
                  value={manualForm.targetFriction}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, targetFriction: e.target.value }))
                  }
                  placeholder="Manual data entry, error-prone reconciliation"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                />
              </div>

              {/* Desired Outcomes tag input */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Desired Outcomes
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualForm.outcomeInput}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, outcomeInput: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOutcome();
                      }
                    }}
                    placeholder="Type an outcome and press Enter"
                    className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
                  />
                  <button
                    type="button"
                    onClick={addOutcome}
                    className="px-3 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80 transition-colors"
                  >
                    Add
                  </button>
                </div>
                {manualForm.desiredOutcomes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {manualForm.desiredOutcomes.map((outcome, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-[#36bf78]/10 text-[#36bf78]"
                      >
                        {outcome}
                        <button
                          type="button"
                          onClick={() => removeOutcome(i)}
                          className="hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#001278] text-white text-sm font-medium hover:bg-[#001278]/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {editingIndex !== null ? "Update Use Case" : "Add Use Case"}
              </button>
            </form>

            {/* Manual use case list */}
            {manualUseCases.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">
                  {manualUseCases.length} use case
                  {manualUseCases.length !== 1 ? "s" : ""} defined
                </p>
                {manualUseCases.map((uc, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-4 rounded-xl border border-border bg-card"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm">
                        {uc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {uc.businessFunction && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#001278]/10 text-[#001278]">
                            {uc.businessFunction}
                          </span>
                        )}
                        {uc.targetFriction && (
                          <span className="text-xs text-muted-foreground">
                            Friction: {uc.targetFriction}
                          </span>
                        )}
                      </div>
                      {uc.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                          {uc.description}
                        </p>
                      )}
                      {uc.desiredOutcomes && uc.desiredOutcomes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {uc.desiredOutcomes.map((o, j) => (
                            <span
                              key={j}
                              className="text-xs px-2 py-0.5 rounded-full bg-[#36bf78]/10 text-[#36bf78]"
                            >
                              {o}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button
                        onClick={() => editManualUseCase(i)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteManualUseCase(i)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== Workforce Parameters ===== */}
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Workforce Parameters
          </h3>
          <p className="text-xs text-muted-foreground">
            These numbers shape the financial analysis. Get close. Precision comes later.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Avg Hourly Rate ($)
              </label>
              <input
                type="number"
                value={workforceParams.avgHourlyRate}
                onChange={(e) =>
                  setWorkforceParams((p) => ({
                    ...p,
                    avgHourlyRate: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Annual Revenue ($)
              </label>
              <input
                type="number"
                value={workforceParams.annualRevenue}
                onChange={(e) =>
                  setWorkforceParams((p) => ({
                    ...p,
                    annualRevenue: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Headcount
              </label>
              <input
                type="number"
                value={workforceParams.headcount}
                onChange={(e) =>
                  setWorkforceParams((p) => ({
                    ...p,
                    headcount: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Adoption Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={workforceParams.adoptionRate}
                onChange={(e) =>
                  setWorkforceParams((p) => ({
                    ...p,
                    adoptionRate: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Data Maturity (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={workforceParams.dataMaturity}
                onChange={(e) =>
                  setWorkforceParams((p) => ({
                    ...p,
                    dataMaturity: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#02a2fd]/50 focus:border-[#02a2fd]"
              />
            </div>
          </div>
        </div>

        {/* ===== Continue Button ===== */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <p className="text-sm text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} use case${selectedCount !== 1 ? "s" : ""} ready.`
              : "Select or add use cases to continue."}
          </p>
          <button
            onClick={handleContinue}
            disabled={selectedCount === 0 || selectMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#001278] text-white font-medium hover:bg-[#001278]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectMutation.isPending ? "Saving..." : "Continue to Mapping"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {selectMutation.isError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(selectMutation.error as Error).message}
          </div>
        )}
      </div>
    </Layout>
  );
}
