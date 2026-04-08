import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { MarinaRateDatabase } from "@shared/schema";
import { STORAGE_TYPES } from "@shared/salescomps-constants";

const SEASONS = ["Annual", "Summer", "Winter", "Peak", "Off-Peak"];
const RATE_TYPES = ["Monthly", "Annual", "Seasonal", "Daily"];

const rateEntrySchema = z.object({
  storageType: z.string().min(1, "Storage type is required"),
  loaMin: z.coerce.number().min(0, "Min LOA must be positive"),
  loaMax: z.coerce.number().min(0, "Max LOA must be positive"),
  monthlyRate: z.coerce.number().min(0, "Monthly rate must be positive"),
  ratePerFoot: z.coerce.number().min(0).optional(),
  rateType: z.string().optional(),
  notes: z.string().optional(),
});

const addRatesFormSchema = z.object({
  rateYear: z.coerce.number().int().min(2000).max(2100),
  rateSeason: z.string().optional(),
  rates: z.array(rateEntrySchema).min(1, "At least one rate is required"),
});

type AddRatesFormValues = z.infer<typeof addRatesFormSchema>;

interface AddMarinaRatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marinaId: string | null;
  onSuccess: () => void;
}

export default function AddMarinaRatesDialog({ open, onOpenChange, marinaId, onSuccess }: AddMarinaRatesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  // Fetch marina details
  const { data: marina } = useQuery<MarinaRateDatabase>({
    queryKey: ["/api/marina-database", marinaId],
    enabled: !!marinaId && open,
  });

  const form = useForm<AddRatesFormValues>({
    resolver: zodResolver(addRatesFormSchema),
    defaultValues: {
      rateYear: currentYear,
      rateSeason: "Annual",
      rates: [
        { storageType: "Wet Slip", loaMin: 0, loaMax: 30, monthlyRate: 0, rateType: "Monthly" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "rates",
  });

  const createRatesMutation = useMutation({
    mutationFn: async (data: AddRatesFormValues) => {
      const ratesToCreate = data.rates.map(rate => ({
        ...rate,
        rateYear: data.rateYear,
        rateSeason: data.rateSeason || "Annual",
        isCurrentRate: true,
      }));

      const response = await apiRequest("POST", `/api/marina-database/${marinaId}/rates/bulk`, {
        rates: ratesToCreate,
        markPreviousAsHistorical: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marina-database"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marina-database", marinaId, "with-rates"] });
      toast({ title: "Rates added successfully" });
      form.reset({
        rateYear: currentYear,
        rateSeason: "Annual",
        rates: [{ storageType: "Wet Slip", loaMin: 0, loaMax: 30, monthlyRate: 0, rateType: "Monthly" }],
      });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to add rates", variant: "destructive" });
    },
  });

  const onSubmit = (data: AddRatesFormValues) => {
    createRatesMutation.mutate(data);
  };

  const addRateEntry = () => {
    append({ storageType: "Wet Slip", loaMin: 0, loaMax: 30, monthlyRate: 0, rateType: "Monthly" });
  };

  // Quick add presets
  const addPresetRates = (preset: "wetSlips" | "dryStorage" | "mooring") => {
    const presets = {
      wetSlips: [
        { storageType: "Wet Slip", loaMin: 0, loaMax: 30, monthlyRate: 0, rateType: "Monthly" as const },
        { storageType: "Wet Slip", loaMin: 30, loaMax: 40, monthlyRate: 0, rateType: "Monthly" as const },
        { storageType: "Wet Slip", loaMin: 40, loaMax: 50, monthlyRate: 0, rateType: "Monthly" as const },
        { storageType: "Wet Slip", loaMin: 50, loaMax: 65, monthlyRate: 0, rateType: "Monthly" as const },
      ],
      dryStorage: [
        { storageType: "Dry Storage", loaMin: 0, loaMax: 25, monthlyRate: 0, rateType: "Monthly" as const },
        { storageType: "Dry Storage", loaMin: 25, loaMax: 35, monthlyRate: 0, rateType: "Monthly" as const },
      ],
      mooring: [
        { storageType: "Mooring", loaMin: 0, loaMax: 40, monthlyRate: 0, rateType: "Monthly" as const },
        { storageType: "Mooring", loaMin: 40, loaMax: 60, monthlyRate: 0, rateType: "Monthly" as const },
      ],
    };
    presets[preset].forEach(rate => append(rate));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Rates</DialogTitle>
          <DialogDescription>
            {marina ? `Adding rates for ${marina.marinaName}` : "Loading marina..."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Year and Season */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rateYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate Year *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-rate-year">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (
                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rateSeason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select season" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEASONS.map(season => (
                          <SelectItem key={season} value={season}>{season}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Quick Add Buttons */}
            <div className="flex gap-2">
              <span className="text-sm text-muted-foreground self-center">Quick add:</span>
              <Button type="button" variant="outline" size="sm" onClick={() => addPresetRates("wetSlips")}>
                Wet Slip Tiers
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addPresetRates("dryStorage")}>
                Dry Storage Tiers
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addPresetRates("mooring")}>
                Mooring Tiers
              </Button>
            </div>

            {/* Rate Entries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Rate Entries</h4>
                <Button type="button" variant="outline" size="sm" onClick={addRateEntry}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rate
                </Button>
              </div>

              {fields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-6 gap-3">
                      <FormField
                        control={form.control}
                        name={`rates.${index}.storageType`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-xs">Storage Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STORAGE_TYPES.map(type => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`rates.${index}.loaMin`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Min LOA (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="0" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`rates.${index}.loaMax`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Max LOA (ft)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} placeholder="30" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`rates.${index}.monthlyRate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Monthly Rate ($)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} placeholder="0.00" data-testid={`input-monthly-rate-${index}`} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`rates.${index}.ratePerFoot`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Per Foot ($/ft)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} value={field.value ?? ""} placeholder="0.00" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={`rates.${index}.notes`}
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormControl>
                          <Input {...field} placeholder="Notes (optional)" className="text-sm" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </Card>
              ))}

              {form.formState.errors.rates?.message && (
                <p className="text-sm text-destructive">{form.formState.errors.rates.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createRatesMutation.isPending} data-testid="button-save-rates">
                {createRatesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Rates
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
