import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentageInput } from "@/components/ui/percentage-input";
import { X, Save, Palette, Target, Settings } from "lucide-react";
import { z } from "zod";
import type { Project, InsertProject, UpdateProject } from "@shared/schema";
import { PROFIT_CENTERS, COASTAL_TYPES, DEFAULT_RECOMMENDATION_WEIGHTS, US_REGIONS } from "@shared/salescomps-constants";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Project name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color code").optional(),
  // Profile fields
  targetNOI: z.number().min(0).optional(),
  targetNOIMin: z.number().min(0).optional(),
  targetNOIMax: z.number().min(0).optional(),
  targetCapacity: z.number().min(0).optional(),
  targetPriceMin: z.number().min(0).optional(),
  targetPriceMax: z.number().min(0).optional(),
  wetSlipsMin: z.number().min(0).optional(),
  wetSlipsMax: z.number().min(0).optional(),
  dryRacksMin: z.number().min(0).optional(),
  dryRacksMax: z.number().min(0).optional(),
  states: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  coastalType: z.enum(['coastal', 'lake', 'any']).optional(),
  mustHaveProfitCenters: z.array(z.string()).default([]),
  niceToHaveProfitCenters: z.array(z.string()).default([]),
  // Weight overrides
  capacityWeight: z.number().min(0).max(1).optional(),
  financialWeight: z.number().min(0).max(1).optional(),
  profitCentersWeight: z.number().min(0).max(1).optional(),
  regionalWeight: z.number().min(0).max(1).optional(),
  geoWeight: z.number().min(0).max(1).optional(),
}).refine(
  (data) => {
    if (data.targetPriceMin !== undefined && data.targetPriceMax !== undefined) {
      return data.targetPriceMin <= data.targetPriceMax;
    }
    return true;
  },
  {
    message: "Minimum price must be less than or equal to maximum price",
    path: ["targetPriceMax"],
  }
).refine(
  (data) => {
    if (data.targetNOIMin !== undefined && data.targetNOIMax !== undefined) {
      return data.targetNOIMin <= data.targetNOIMax;
    }
    return true;
  },
  {
    message: "Minimum NOI must be less than or equal to maximum NOI",
    path: ["targetNOIMax"],
  }
).refine(
  (data) => {
    if (data.wetSlipsMin !== undefined && data.wetSlipsMax !== undefined) {
      return data.wetSlipsMin <= data.wetSlipsMax;
    }
    return true;
  },
  {
    message: "Minimum wet slips must be less than or equal to maximum wet slips",
    path: ["wetSlipsMax"],
  }
).refine(
  (data) => {
    if (data.dryRacksMin !== undefined && data.dryRacksMax !== undefined) {
      return data.dryRacksMin <= data.dryRacksMax;
    }
    return true;
  },
  {
    message: "Minimum dry racks must be less than or equal to maximum dry racks",
    path: ["dryRacksMax"],
  }
);

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: InsertProject | UpdateProject) => void;
  project?: Project;
  isLoading?: boolean;
}

const defaultColors = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
  '#14b8a6', // teal-500
  '#06b6d4', // cyan-500
  '#0ea5e9', // sky-500
  '#3b82f6', // blue-500
  '#6366f1', // indigo-500
  '#8b5cf6', // violet-500
  '#a855f7', // purple-500
  '#d946ef', // fuchsia-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
];

export default function ProjectForm({ open, onClose, onSubmit, project, isLoading = false }: ProjectFormProps) {
  const isEdit = !!project;

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      color: project?.color || "#64748b",
      // Profile fields
      targetNOI: project?.profile?.targetNOI,
      targetNOIMin: project?.profile?.targetNOIMin,
      targetNOIMax: project?.profile?.targetNOIMax,
      targetCapacity: project?.profile?.targetCapacity,
      targetPriceMin: project?.profile?.targetPriceMin,
      targetPriceMax: project?.profile?.targetPriceMax,
      wetSlipsMin: project?.profile?.wetSlipsMin,
      wetSlipsMax: project?.profile?.wetSlipsMax,
      dryRacksMin: project?.profile?.dryRacksMin,
      dryRacksMax: project?.profile?.dryRacksMax,
      // Handle backward compatibility: convert legacy region to regions array
      states: project?.profile?.states || [],
      regions: project?.profile?.regions || 
               ((project?.profile as any)?.region ? [(project?.profile as any).region] : []),
      coastalType: project?.profile?.coastalType,
      mustHaveProfitCenters: project?.profile?.mustHaveProfitCenters || [],
      niceToHaveProfitCenters: project?.profile?.niceToHaveProfitCenters || [],
      // Weight overrides
      capacityWeight: project?.weightOverrides?.capacity,
      financialWeight: project?.weightOverrides?.financial,
      profitCentersWeight: project?.weightOverrides?.profitCenters,
      regionalWeight: project?.weightOverrides?.regional,
      geoWeight: project?.weightOverrides?.geo,
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        description: project.description || "",
        color: project.color || "#64748b",
        // Profile fields
        targetNOI: project.profile?.targetNOI,
        targetNOIMin: project.profile?.targetNOIMin,
        targetNOIMax: project.profile?.targetNOIMax,
        targetCapacity: project.profile?.targetCapacity,
        targetPriceMin: project.profile?.targetPriceMin,
        targetPriceMax: project.profile?.targetPriceMax,
        wetSlipsMin: project.profile?.wetSlipsMin,
        wetSlipsMax: project.profile?.wetSlipsMax,
        dryRacksMin: project.profile?.dryRacksMin,
        dryRacksMax: project.profile?.dryRacksMax,
        // Handle backward compatibility: convert legacy region to regions array
        states: project.profile?.states || [],
        regions: project.profile?.regions || 
                 ((project.profile as any)?.region ? [(project.profile as any).region] : []),
        coastalType: project.profile?.coastalType,
        mustHaveProfitCenters: project.profile?.mustHaveProfitCenters || [],
        niceToHaveProfitCenters: project.profile?.niceToHaveProfitCenters || [],
        // Weight overrides
        capacityWeight: project.weightOverrides?.capacity,
        financialWeight: project.weightOverrides?.financial,
        profitCentersWeight: project.weightOverrides?.profitCenters,
        regionalWeight: project.weightOverrides?.regional,
        geoWeight: project.weightOverrides?.geo,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        color: "#64748b",
        // Profile fields - reset to empty
        targetNOI: undefined,
        targetNOIMin: undefined,
        targetNOIMax: undefined,
        targetCapacity: undefined,
        targetPriceMin: undefined,
        targetPriceMax: undefined,
        wetSlipsMin: undefined,
        wetSlipsMax: undefined,
        dryRacksMin: undefined,
        dryRacksMax: undefined,
        states: [],
        regions: [],
        coastalType: undefined,
        mustHaveProfitCenters: [],
        niceToHaveProfitCenters: [],
        // Weight overrides - reset to empty
        capacityWeight: undefined,
        financialWeight: undefined,
        profitCentersWeight: undefined,
        regionalWeight: undefined,
        geoWeight: undefined,
      });
    }
  }, [project, form]);

  const handleSubmit = (data: ProjectFormData) => {
    // Build profile object
    const profile = {
      targetNOI: data.targetNOI || undefined,
      targetNOIMin: data.targetNOIMin || undefined,
      targetNOIMax: data.targetNOIMax || undefined,
      targetCapacity: data.targetCapacity || undefined,
      targetPriceMin: data.targetPriceMin || undefined,
      targetPriceMax: data.targetPriceMax || undefined,
      wetSlipsMin: data.wetSlipsMin || undefined,
      wetSlipsMax: data.wetSlipsMax || undefined,
      dryRacksMin: data.dryRacksMin || undefined,
      dryRacksMax: data.dryRacksMax || undefined,
      states: data.states?.length ? data.states : undefined,
      regions: data.regions?.length ? data.regions : undefined,
      coastalType: (data.coastalType && data.coastalType !== 'any') ? data.coastalType : undefined,
      mustHaveProfitCenters: data.mustHaveProfitCenters?.length ? data.mustHaveProfitCenters : undefined,
      niceToHaveProfitCenters: data.niceToHaveProfitCenters?.length ? data.niceToHaveProfitCenters : undefined,
    };
    
    // Build weight overrides object
    const weightOverrides = {
      capacity: data.capacityWeight || undefined,
      financial: data.financialWeight || undefined,
      profitCenters: data.profitCentersWeight || undefined,
      regional: data.regionalWeight || undefined,
      geo: data.geoWeight || undefined,
    };
    
    // Remove empty optional fields
    const cleanData = {
      name: data.name,
      description: data.description || undefined,
      color: data.color || undefined,
      profile: Object.keys(profile).some(key => profile[key as keyof typeof profile] !== undefined) ? profile : undefined,
      weightOverrides: Object.keys(weightOverrides).some(key => weightOverrides[key as keyof typeof weightOverrides] !== undefined) ? weightOverrides : undefined,
    };

    onSubmit(cleanData);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const selectedColor = form.watch("color");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Project" : "Create New Project"}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 h-8 w-8 p-0"
            onClick={handleClose}
            data-testid="button-close-project-form"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Project Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Enter project name..."
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Optional project description..."
                        rows={3}
                        data-testid="textarea-project-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Project Profile for Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Project Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Target NOI */}
                  <FormField
                    control={form.control}
                    name="targetNOI"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target NOI</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="1,000,000"
                            data-testid="input-target-noi"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Target Capacity */}
                  <FormField
                    control={form.control}
                    name="targetCapacity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Capacity (slips)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="200"
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            value={field.value ?? ""}
                            data-testid="input-target-capacity"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Price Range */}
                  <FormField
                    control={form.control}
                    name="targetPriceMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Price</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="1,000,000"
                            data-testid="input-target-price-min"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="targetPriceMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Price</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="10,000,000"
                            data-testid="input-target-price-max"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  {/* States */}
                  <FormField
                    control={form.control}
                    name="states"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target States</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-1">
                            <Input
                              placeholder="Type state and press Enter to add (e.g., FL, CA, TX)"
                              className="flex-1 min-w-[200px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const input = e.target as HTMLInputElement;
                                  const value = input.value.trim().toUpperCase();
                                  if (value && !field.value.includes(value)) {
                                    field.onChange([...field.value, value]);
                                    input.value = '';
                                  }
                                }
                              }}
                              data-testid="input-target-states"
                            />
                          </div>
                        </FormControl>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {field.value?.map((state, index) => (
                            <span 
                              key={index} 
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded"
                            >
                              {state}
                              <button
                                type="button"
                                onClick={() => {
                                  const newStates = field.value.filter((_, i) => i !== index);
                                  field.onChange(newStates);
                                }}
                                className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                                data-testid={`remove-state-${index}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Regions */}
                  <FormField
                    control={form.control}
                    name="regions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Regions</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {US_REGIONS.map((region) => (
                            <div key={region} className="flex items-center space-x-2">
                              <Checkbox
                                id={`region-${region}`}
                                checked={field.value?.includes(region) || false}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...(field.value || []), region]);
                                  } else {
                                    field.onChange(
                                      field.value?.filter((r: string) => r !== region) || []
                                    );
                                  }
                                }}
                                data-testid={`checkbox-region-${region.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                              />
                              <Label 
                                htmlFor={`region-${region}`}
                                className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {region}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {/* Water Type */}
                  <FormField
                    control={form.control}
                    name="coastalType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Water Type</FormLabel>
                        <Select onValueChange={(v) => field.onChange(v || undefined)} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-target-coastal-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="any">Any</SelectItem>
                            {COASTAL_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Must Have Profit Centers */}
                <FormField
                  control={form.control}
                  name="mustHaveProfitCenters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Must Have Profit Centers</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {PROFIT_CENTERS.map((profitCenter) => (
                          <div key={profitCenter} className="flex items-center space-x-2">
                            <Checkbox
                              id={`must-have-${profitCenter}`}
                              checked={field.value?.includes(profitCenter) || false}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), profitCenter]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((pc: string) => pc !== profitCenter) || []
                                  );
                                }
                              }}
                              data-testid={`checkbox-must-have-${profitCenter.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                            />
                            <Label 
                              htmlFor={`must-have-${profitCenter}`}
                              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {profitCenter}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nice to Have Profit Centers */}
                <FormField
                  control={form.control}
                  name="niceToHaveProfitCenters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nice to Have Profit Centers</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {PROFIT_CENTERS.map((profitCenter) => (
                          <div key={profitCenter} className="flex items-center space-x-2">
                            <Checkbox
                              id={`nice-to-have-${profitCenter}`}
                              checked={field.value?.includes(profitCenter) || false}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), profitCenter]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((pc: string) => pc !== profitCenter) || []
                                  );
                                }
                              }}
                              data-testid={`checkbox-nice-to-have-${profitCenter.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`}
                            />
                            <Label 
                              htmlFor={`nice-to-have-${profitCenter}`}
                              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {profitCenter}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Recommendation Algorithm Weight Overrides */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Algorithm Weight Preferences
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust how important each factor is for recommendations (0% to 100%). Leave empty for defaults.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="capacityWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Capacity Similarity (default: {(DEFAULT_RECOMMENDATION_WEIGHTS.capacity * 100).toFixed(1)}%)</FormLabel>
                        <FormControl>
                          <PercentageInput
                            value={field.value !== undefined && field.value !== null ? field.value * 100 : undefined}
                            onValueChange={(val) => field.onChange(val !== undefined ? val / 100 : undefined)}
                            placeholder={(DEFAULT_RECOMMENDATION_WEIGHTS.capacity * 100).toFixed(1)}
                            data-testid="input-capacity-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="financialWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Financial Similarity (default: {(DEFAULT_RECOMMENDATION_WEIGHTS.financial * 100).toFixed(1)}%)</FormLabel>
                        <FormControl>
                          <PercentageInput
                            value={field.value !== undefined && field.value !== null ? field.value * 100 : undefined}
                            onValueChange={(val) => field.onChange(val !== undefined ? val / 100 : undefined)}
                            placeholder={(DEFAULT_RECOMMENDATION_WEIGHTS.financial * 100).toFixed(1)}
                            data-testid="input-financial-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="profitCentersWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Profit Centers (default: {(DEFAULT_RECOMMENDATION_WEIGHTS.profitCenters * 100).toFixed(1)}%)</FormLabel>
                        <FormControl>
                          <PercentageInput
                            value={field.value !== undefined && field.value !== null ? field.value * 100 : undefined}
                            onValueChange={(val) => field.onChange(val !== undefined ? val / 100 : undefined)}
                            placeholder={(DEFAULT_RECOMMENDATION_WEIGHTS.profitCenters * 100).toFixed(1)}
                            data-testid="input-profit-centers-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="regionalWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Regional Match (default: {(DEFAULT_RECOMMENDATION_WEIGHTS.regional * 100).toFixed(1)}%)</FormLabel>
                        <FormControl>
                          <PercentageInput
                            value={field.value !== undefined && field.value !== null ? field.value * 100 : undefined}
                            onValueChange={(val) => field.onChange(val !== undefined ? val / 100 : undefined)}
                            placeholder={(DEFAULT_RECOMMENDATION_WEIGHTS.regional * 100).toFixed(1)}
                            data-testid="input-regional-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="geoWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Geographic (default: {(DEFAULT_RECOMMENDATION_WEIGHTS.geo * 100).toFixed(1)}%)</FormLabel>
                        <FormControl>
                          <PercentageInput
                            value={field.value !== undefined && field.value !== null ? field.value * 100 : undefined}
                            onValueChange={(val) => field.onChange(val !== undefined ? val / 100 : undefined)}
                            placeholder={(DEFAULT_RECOMMENDATION_WEIGHTS.geo * 100).toFixed(1)}
                            data-testid="input-geo-weight"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                data-testid="button-cancel-project"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-save-project"
              >
                {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2" />}
                <Save className="mr-2 h-4 w-4" />
                {isEdit ? "Update Project" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}