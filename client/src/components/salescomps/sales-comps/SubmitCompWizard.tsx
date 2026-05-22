import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Shield,
  Upload,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const DATA_SOURCES = [
  { value: "broker", label: "Broker / Brokerage" },
  { value: "direct_research", label: "Direct Research" },
  { value: "costar", label: "CoStar" },
  { value: "loopnet", label: "LoopNet" },
  { value: "public_records", label: "Public Records" },
  { value: "internal", label: "Internal" },
];

const step1Schema = z.object({
  marina: z.string().min(2, "Marina name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  county: z.string().optional(),
});

const step2Schema = z.object({
  salePrice: z.coerce.number().positive("Sale price must be positive").optional(),
  saleYear: z.coerce.number().min(1980).max(new Date().getFullYear()).optional(),
  saleMonth: z.coerce.number().min(1).max(12).optional(),
  capRate: z.coerce.number().min(0).max(100).optional(),
  noi: z.coerce.number().positive().optional(),
  wetSlips: z.coerce.number().int().nonnegative().optional(),
  dryRacks: z.coerce.number().int().nonnegative().optional(),
  seller: z.string().optional(),
  company: z.string().optional(),
});

const step3Schema = z.object({
  dataSource: z.string().optional(),
  brokerage: z.string().optional(),
  agentFirstName: z.string().optional(),
  agentLastName: z.string().optional(),
  sourceNotes: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

type AllFormData = Step1Data & Step2Data & Step3Data;

function computeConfidenceScore(data: Partial<AllFormData>, docCount: number): number {
  let score = 20;
  if (data.marina) score += 10;
  if (data.city && data.state) score += 10;
  if (data.address) score += 5;
  if (data.salePrice) score += 15;
  if (data.saleYear) score += 10;
  if (data.capRate) score += 5;
  if (data.noi) score += 5;
  if (data.wetSlips || data.dryRacks) score += 5;
  if (data.dataSource) score += 5;
  if (data.brokerage || data.agentFirstName) score += 5;
  if (data.sourceNotes && data.sourceNotes.length > 20) score += 5;
  score += Math.min(docCount * 10, 30);
  return Math.min(score, 100);
}

function ConfidenceMeter({ score }: { score: number }) {
  const tier =
    score >= 70 ? "document-verified" : score >= 45 ? "community-verified" : "unverified";
  const color =
    tier === "document-verified"
      ? "bg-emerald-500"
      : tier === "community-verified"
      ? "bg-blue-500"
      : "bg-amber-400";
  const label =
    tier === "document-verified"
      ? "Document-Verified"
      : tier === "community-verified"
      ? "Community-Verified"
      : "Unverified";
  const badgeClass =
    tier === "document-verified"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : tier === "community-verified"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : "bg-amber-100 text-amber-800 border-amber-200";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Confidence Score
        </span>
        <Badge variant="outline" className={`${badgeClass} border text-xs`}>
          {label}
        </Badge>
      </div>
      <Progress value={score} className={`h-2 ${color}`} />
      <p className="text-xs text-muted-foreground">
        Score: {score}/100 — Add more fields and documents to increase confidence
      </p>
    </div>
  );
}

interface DuplicateResult {
  id: string;
  marina: string;
  city: string | null;
  state: string | null;
  salePrice: number | null;
  saleYear: number | null;
  confidence: number;
}

interface SubmitCompWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, label: "Property", icon: Building2 },
  { id: 2, label: "Deal Terms", icon: DollarSign },
  { id: 3, label: "Attribution", icon: FileText },
  { id: 4, label: "Review", icon: CheckCircle2 },
];

export default function SubmitCompWizard({ open, onClose, onSuccess }: SubmitCompWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<AllFormData>>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; size: number; type: string; key?: string; url?: string }>>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [acknowledgedDuplicates, setAcknowledgedDuplicates] = useState(false);

  const confidenceScore = computeConfidenceScore(formData, uploadedDocs.length + pendingFiles.length);

  const step1Form = useForm<Step1Data>({ resolver: zodResolver(step1Schema), defaultValues: formData });
  const step2Form = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: formData });
  const step3Form = useForm<Step3Data>({ resolver: zodResolver(step3Schema), defaultValues: formData });

  const onDrop = useCallback((accepted: File[]) => {
    setPendingFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const submitMutation = useMutation({
    mutationFn: async (data: Partial<AllFormData>) => {
      const res = await apiRequest("POST", "/api/sales-comps", {
        ...data,
        importSource: "broker_submission",
        verificationStatus: confidenceScore >= 70 ? "pending" : "unverified",
        dataQualityScore: confidenceScore,
        sourceConfidence: confidenceScore,
        submissionDocuments: uploadedDocs,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-comps"] });
      toast({
        title: "Comp submitted successfully",
        description: `Your comp was submitted with a confidence score of ${confidenceScore}/100.`,
      });
      onSuccess?.();
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep(1);
    setFormData({});
    setPendingFiles([]);
    setUploadedDocs([]);
    setUploadingDocs(false);
    setDuplicates([]);
    setAcknowledgedDuplicates(false);
    step1Form.reset();
    step2Form.reset();
    step3Form.reset();
    onClose();
  };

  const goToStep = (target: number) => setStep(target);

  const handleStep1Next = step1Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    goToStep(2);
  });

  const handleStep2Next = step2Form.handleSubmit((data) => {
    setFormData((prev) => ({ ...prev, ...data }));
    goToStep(3);
  });

  const handleStep3Next = step3Form.handleSubmit(async (data) => {
    const merged = { ...formData, ...data };
    setFormData(merged);

    // Upload any pending files to S3
    if (pendingFiles.length > 0) {
      setUploadingDocs(true);
      try {
        const fd = new FormData();
        pendingFiles.forEach((f) => fd.append("files", f));
        const uploadRes = await fetch("/api/sales-comps/submission-docs", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (uploadRes.ok) {
          const { files: storedFiles } = await uploadRes.json();
          setUploadedDocs((prev) => [...prev, ...storedFiles]);
        }
      } catch {
        // Non-fatal — docs won't be attached but submission can proceed
      } finally {
        setPendingFiles([]);
        setUploadingDocs(false);
      }
    }

    setCheckingDuplicates(true);
    try {
      const res = await apiRequest("POST", "/api/sales-comps/check-duplicates", {
        marina: merged.marina,
        address: merged.address,
        city: merged.city,
        state: merged.state,
        salePrice: merged.salePrice,
        saleYear: merged.saleYear,
      });
      const result = await res.json();
      setDuplicates(result?.duplicates || []);
    } catch {
      setDuplicates([]);
    } finally {
      setCheckingDuplicates(false);
      goToStep(4);
    }
  });

  const handleSubmit = () => {
    submitMutation.mutate(formData);
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Submit a Comp</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-1 ${step >= s.id ? "text-primary" : ""}`}
                  >
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </div>
                );
              })}
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <ConfidenceMeter score={confidenceScore} />

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Step 1: Property Details
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Marina / Property Name *</Label>
                  <Input
                    {...step1Form.register("marina")}
                    placeholder="e.g. Suncoast Marina"
                    className="h-9"
                  />
                  {step1Form.formState.errors.marina && (
                    <p className="text-xs text-destructive">{step1Form.formState.errors.marina.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Street Address</Label>
                  <Input {...step1Form.register("address")} placeholder="123 Marina Blvd" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">City</Label>
                    <Input {...step1Form.register("city")} placeholder="City" className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">State</Label>
                    <Select
                      onValueChange={(v) => step1Form.setValue("state", v)}
                      defaultValue={formData.state}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="State" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">County</Label>
                  <Input {...step1Form.register("county")} placeholder="County (optional)" className="h-9" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleStep1Next} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Step 2: Deal Terms
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Sale Price ($)</Label>
                  <Input
                    {...step2Form.register("salePrice")}
                    type="number"
                    placeholder="e.g. 5000000"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Cap Rate (%)</Label>
                  <Input
                    {...step2Form.register("capRate")}
                    type="number"
                    step="0.01"
                    placeholder="e.g. 6.5"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Sale Year</Label>
                  <Input
                    {...step2Form.register("saleYear")}
                    type="number"
                    placeholder="e.g. 2024"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Sale Month</Label>
                  <Select
                    onValueChange={(v) => step2Form.setValue("saleMonth", Number(v))}
                    defaultValue={formData.saleMonth?.toString()}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">NOI ($)</Label>
                  <Input
                    {...step2Form.register("noi")}
                    type="number"
                    placeholder="Annual NOI"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Wet Slips</Label>
                  <Input
                    {...step2Form.register("wetSlips")}
                    type="number"
                    placeholder="0"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Dry Racks</Label>
                  <Input
                    {...step2Form.register("dryRacks")}
                    type="number"
                    placeholder="0"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Buyer / New Owner</Label>
                  <Input {...step2Form.register("company")} placeholder="Buyer company" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Seller</Label>
                  <Input {...step2Form.register("seller")} placeholder="Seller name" className="h-9" />
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goToStep(1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleStep2Next} className="gap-1">
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Step 3: Source Attribution &amp; Documents
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Data Source</Label>
                  <Select
                    onValueChange={(v) => step3Form.setValue("dataSource", v)}
                    defaultValue={formData.dataSource as string}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Brokerage</Label>
                  <Input
                    {...step3Form.register("brokerage")}
                    placeholder="e.g. CBRE, JLL"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Agent First Name</Label>
                  <Input
                    {...step3Form.register("agentFirstName")}
                    placeholder="First"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Agent Last Name</Label>
                  <Input
                    {...step3Form.register("agentLastName")}
                    placeholder="Last"
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Source Notes</Label>
                <Textarea
                  {...step3Form.register("sourceNotes")}
                  placeholder="Describe how you obtained this data, any caveats, or context..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Supporting Documents</Label>
                <p className="text-xs text-muted-foreground">
                  Attach closing statements, offering memoranda, or other documentation (PDF, Excel, images). Each document increases your confidence score.
                </p>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {isDragActive ? "Drop files here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, Excel, images up to 10MB</p>
                </div>
                {(pendingFiles.length > 0 || uploadedDocs.length > 0) && (
                  <div className="space-y-1">
                    {pendingFiles.map((file, idx) => (
                      <div
                        key={`pending-${idx}`}
                        className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1"
                      >
                        <span className="truncate flex-1">{file.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {(file.size / 1024).toFixed(0)}KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {uploadedDocs.map((doc, idx) => (
                      <div
                        key={`uploaded-${idx}`}
                        className="flex items-center justify-between text-xs bg-green-50 dark:bg-green-950/20 rounded px-2 py-1"
                      >
                        <span className="truncate flex-1 text-green-700 dark:text-green-400">{doc.name}</span>
                        <span className="text-muted-foreground ml-2">
                          {(doc.size / 1024).toFixed(0)}KB
                        </span>
                        <span className="ml-2 text-green-600 dark:text-green-400 text-xs">✓</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goToStep(2)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleStep3Next} disabled={checkingDuplicates || uploadingDocs} className="gap-1">
                  {uploadingDocs ? "Uploading..." : checkingDuplicates ? "Checking..." : "Review"}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Step 4: Review &amp; Submit
              </h3>

              {duplicates.length > 0 && !acknowledgedDuplicates && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <p className="font-medium mb-2">
                      {duplicates.length} potential duplicate{duplicates.length > 1 ? "s" : ""} found
                    </p>
                    <div className="space-y-1">
                      {duplicates.map((d) => (
                        <div key={d.id} className="text-xs bg-white/60 rounded p-1.5">
                          <span className="font-medium">{d.marina}</span>
                          {(d.city || d.state) && ` — ${[d.city, d.state].filter(Boolean).join(", ")}`}
                          {d.salePrice && ` — $${Number(d.salePrice).toLocaleString()}`}
                          {d.saleYear && ` (${d.saleYear})`}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {d.confidence}% match
                          </Badge>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 text-xs"
                      onClick={() => setAcknowledgedDuplicates(true)}
                    >
                      This is a different property — proceed anyway
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Card>
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Marina</span>
                      <p className="font-medium">{formData.marina || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location</span>
                      <p className="font-medium">
                        {[formData.city, formData.state].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sale Price</span>
                      <p className="font-medium">
                        {formData.salePrice ? `$${Number(formData.salePrice).toLocaleString()}` : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sale Date</span>
                      <p className="font-medium">
                        {formData.saleYear
                          ? `${formData.saleMonth ? new Date(2000, formData.saleMonth - 1).toLocaleString("default", { month: "short" }) + " " : ""}${formData.saleYear}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cap Rate</span>
                      <p className="font-medium">{formData.capRate ? `${formData.capRate}%` : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Units</span>
                      <p className="font-medium">
                        {(formData.wetSlips || 0) + (formData.dryRacks || 0) || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Source</span>
                      <p className="font-medium">
                        {DATA_SOURCES.find((s) => s.value === formData.dataSource)?.label || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Documents</span>
                      <p className="font-medium">
                        {(uploadedDocs.length + pendingFiles.length) > 0
                          ? `${uploadedDocs.length + pendingFiles.length} file${(uploadedDocs.length + pendingFiles.length) > 1 ? "s" : ""}`
                          : "None"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ConfidenceMeter score={confidenceScore} />

              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => goToStep(3)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitMutation.isPending ||
                    (duplicates.length > 0 && !acknowledgedDuplicates)
                  }
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Comp"}
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
