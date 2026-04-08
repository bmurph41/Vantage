import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";

const compSetFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  compType: z.enum(['RATE', 'SALES']),
  subjectId: z.string().optional(),
  scoringConfig: z.object({
    weights: z.object({
      geo: z.number().min(0).max(1),
      capacity: z.number().min(0).max(1),
      slipMix: z.number().min(0).max(1),
      capabilities: z.number().min(0).max(1),
    }),
    geoMaxMiles: z.number().min(1).max(500),
  }),
});

type CompSetFormValues = z.infer<typeof compSetFormSchema>;

interface MarinaSubject {
  id: string;
  name: string;
  city?: string;
  state?: string;
}

interface CompSet {
  id: string;
  name: string;
  compType: 'RATE' | 'SALES';
  subjectId?: string;
  scoringConfig?: {
    weights?: {
      geo?: number;
      capacity?: number;
      slipMix?: number;
      capabilities?: number;
    };
    geoMaxMiles?: number;
  };
}

interface CompSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compSet: CompSet | null;
  subjects: MarinaSubject[];
}

export default function CompSetDialog({ open, onOpenChange, compSet, subjects }: CompSetDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!compSet;

  const defaultWeights = {
    geo: 0.4,
    capacity: 0.3,
    slipMix: 0.2,
    capabilities: 0.1,
  };

  const form = useForm<CompSetFormValues>({
    resolver: zodResolver(compSetFormSchema),
    defaultValues: {
      name: "",
      compType: "RATE",
      subjectId: "",
      scoringConfig: {
        weights: defaultWeights,
        geoMaxMiles: 100,
      },
    },
  });

  useEffect(() => {
    if (compSet) {
      form.reset({
        name: compSet.name,
        compType: compSet.compType,
        subjectId: compSet.subjectId || "",
        scoringConfig: {
          weights: {
            geo: compSet.scoringConfig?.weights?.geo ?? defaultWeights.geo,
            capacity: compSet.scoringConfig?.weights?.capacity ?? defaultWeights.capacity,
            slipMix: compSet.scoringConfig?.weights?.slipMix ?? defaultWeights.slipMix,
            capabilities: compSet.scoringConfig?.weights?.capabilities ?? defaultWeights.capabilities,
          },
          geoMaxMiles: compSet.scoringConfig?.geoMaxMiles ?? 100,
        },
      });
    } else {
      form.reset({
        name: "",
        compType: "RATE",
        subjectId: "",
        scoringConfig: {
          weights: defaultWeights,
          geoMaxMiles: 100,
        },
      });
    }
  }, [compSet]);

  const createMutation = useMutation({
    mutationFn: async (data: CompSetFormValues) => {
      const res = await fetch('/api/marina-comps/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          subjectId: data.subjectId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create comp set');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-comps/sets'] });
      toast({ title: "Comp set created" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CompSetFormValues) => {
      const res = await fetch(`/api/marina-comps/sets/${compSet!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          subjectId: data.subjectId || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update comp set');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marina-comps/sets'] });
      toast({ title: "Comp set updated" });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: CompSetFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const weights = form.watch('scoringConfig.weights');
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Comp Set" : "New Comp Set"}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the comp set configuration" 
              : "Create a new comparable set with similarity scoring weights"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comp Set Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Q4 2025 Rate Analysis" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-">
              <FormField
                control={form.control}
                name="compType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comp Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RATE">Rate Comps</SelectItem>
                        <SelectItem value="SALES">Sales Comps</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Marina</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject marina" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}{subject.city && ` - ${subject.city}, ${subject.state}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Similarity Scoring Weights</h4>
                <span className={`text-sm ${Math.abs(totalWeight - 1) < 0.01 ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Total: {(totalWeight * 100).toFixed(0)}%
                </span>
              </div>

              <FormField
                control={form.control}
                name="scoringConfig.weights.geo"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Geographic Distance</FormLabel>
                      <span className="text-sm text-muted-foreground">{(field.value * 100).toFixed(0)}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value * 100]}
                        onValueChange={([val]) => field.onChange(val / 100)}
                        max={100}
                        step={5}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scoringConfig.weights.capacity"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Capacity Match</FormLabel>
                      <span className="text-sm text-muted-foreground">{(field.value * 100).toFixed(0)}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value * 100]}
                        onValueChange={([val]) => field.onChange(val / 100)}
                        max={100}
                        step={5}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scoringConfig.weights.slipMix"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Slip Mix Similarity</FormLabel>
                      <span className="text-sm text-muted-foreground">{(field.value * 100).toFixed(0)}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value * 100]}
                        onValueChange={([val]) => field.onChange(val / 100)}
                        max={100}
                        step={5}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scoringConfig.weights.capabilities"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm">Capabilities Match</FormLabel>
                      <span className="text-sm text-muted-foreground">{(field.value * 100).toFixed(0)}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value * 100]}
                        onValueChange={([val]) => field.onChange(val / 100)}
                        max={100}
                        step={5}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="scoringConfig.geoMaxMiles"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Distance (miles)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 100)}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum distance for geographic similarity scoring
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
