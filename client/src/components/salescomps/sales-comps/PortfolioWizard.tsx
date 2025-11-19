import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { X, ArrowLeft, ArrowRight, Check, Plus } from "lucide-react";
import { salesCompsApi } from '@/lib/salescomps/api';
import { queryKeys } from '@/lib/salescomps/queryKeys';
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { SalesComp, InsertSalesComp } from "@shared/schema";

// Month names for the dropdown
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

// Helper to convert month name to number (1-12)
const monthNameToNumber = (monthName: string): number | undefined => {
  const index = MONTH_NAMES.indexOf(monthName as typeof MONTH_NAMES[number]);
  return index >= 0 ? index + 1 : undefined;
};

// Simplified schema for portfolio wizard - we'll use a less restrictive schema
const marinaDataSchema = z.object({
  marinaName: z.string().min(1, "Marina name is required"),
  // All other fields are optional and will be collected in the detailed form
  salePrice: z.union([z.string(), z.number()]).optional(),
  capRate: z.union([z.string(), z.number()]).optional(),
  noi: z.union([z.string(), z.number()]).optional(),
  saleMonth: z.string().optional(),
  saleYear: z.union([z.string(), z.number()]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  wetSlips: z.union([z.string(), z.number()]).optional(),
  dryRacks: z.union([z.string(), z.number()]).optional(),
});

type MarinaData = z.infer<typeof marinaDataSchema>;

// Empty marina template - ensures all fields start blank
const emptyMarina: MarinaData = {
  marinaName: "",
  salePrice: "",
  capRate: "",
  noi: "",
  saleMonth: undefined,
  saleYear: "",
  city: "",
  state: "",
  wetSlips: "",
  dryRacks: "",
};

interface PortfolioWizardProps {
  open: boolean;
  onClose: () => void;
}

export default function PortfolioWizard({ open, onClose }: PortfolioWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [portfolioName, setPortfolioName] = useState("");
  const [marinaCount, setMarinaCount] = useState(3);
  const [marinaDataList, setMarinaDataList] = useState<MarinaData[]>([
    { ...emptyMarina },
    { ...emptyMarina },
    { ...emptyMarina },
  ]);
  const [currentMarinaIndex, setCurrentMarinaIndex] = useState(0);
  
  // Form for Step 2 (individual marina data)
  const marinaForm = useForm<MarinaData>({
    resolver: zodResolver(marinaDataSchema),
    defaultValues: { ...emptyMarina },
  });

  // Reset wizard state when dialog closes
  const handleClose = () => {
    setStep(1);
    setPortfolioName("");
    setMarinaCount(3);
    setMarinaDataList([{ ...emptyMarina }, { ...emptyMarina }, { ...emptyMarina }]);
    setCurrentMarinaIndex(0);
    marinaForm.reset({ ...emptyMarina });
    onClose();
  };

  // Add a new marina to the count
  const handleAddMarina = () => {
    setMarinaCount(prev => Math.min(20, prev + 1));
  };

  // Step 1: Continue to Step 2
  const handleStep1Continue = () => {
    if (!portfolioName.trim()) {
      toast({
        title: "Portfolio name required",
        description: "Please enter a name for your portfolio",
        variant: "destructive",
      });
      return;
    }
    
    // Initialize marina data list based on count with empty marina templates
    const initialMarinas = Array.from({ length: marinaCount }, () => ({ ...emptyMarina }));
    setMarinaDataList(initialMarinas);
    setCurrentMarinaIndex(0);
    marinaForm.reset({ ...emptyMarina });
    setStep(2);
  };

  // Step 2: Save current marina and move to next or to review
  const handleSaveMarina = (data: MarinaData) => {
    // Update marina data list - merge with emptyMarina to ensure full object
    const updated = [...marinaDataList];
    updated[currentMarinaIndex] = { ...emptyMarina, ...data };
    setMarinaDataList(updated);

    // Move to next marina or to review step
    if (currentMarinaIndex < marinaCount - 1) {
      const nextIndex = currentMarinaIndex + 1;
      setCurrentMarinaIndex(nextIndex);
      // Merge with emptyMarina to ensure blank fields for new marina or saved data for visited marina
      marinaForm.reset({ ...emptyMarina, ...updated[nextIndex] });
    } else {
      setStep(3);
    }
  };

  // Step 2: Go to previous marina
  const handlePreviousMarina = () => {
    if (currentMarinaIndex > 0) {
      const prevIndex = currentMarinaIndex - 1;
      setCurrentMarinaIndex(prevIndex);
      // Merge with emptyMarina to ensure all fields are properly set
      marinaForm.reset({ ...emptyMarina, ...marinaDataList[prevIndex] });
    } else {
      setStep(1);
    }
  };

  // Step 3: Create portfolio mutation with rollback on failure
  const createPortfolioMutation = useMutation({
    mutationFn: async () => {
      let parentComp: SalesComp | null = null;
      
      try {
        // Step 1: Create portfolio parent
        const parentPayload: Partial<InsertSalesComp> = {
          marina: portfolioName,
          isPortfolio: true,
          isChild: false,
        };
        
        parentComp = await salesCompsApi.createComp(parentPayload as InsertSalesComp);
        
        // Step 2: Create all child marinas
        const childPromises = marinaDataList.map((marinaData) => {
          const childPayload: Partial<InsertSalesComp> = {
            marina: marinaData.marinaName,
            parentPortfolioId: parentComp!.id,
            isChild: true,
            isPortfolio: false,
            // Add any additional data from marinaData
            salePrice: marinaData.salePrice ? Number(marinaData.salePrice) : undefined,
            capRate: marinaData.capRate ? Number(marinaData.capRate) : undefined,
            noi: marinaData.noi ? Number(marinaData.noi) : undefined,
            saleMonth: marinaData.saleMonth ? monthNameToNumber(marinaData.saleMonth) : undefined,
            saleYear: marinaData.saleYear ? Number(marinaData.saleYear) : undefined,
            city: marinaData.city || undefined,
            state: marinaData.state || undefined,
            wetSlips: marinaData.wetSlips ? Number(marinaData.wetSlips) : undefined,
            dryRacks: marinaData.dryRacks ? Number(marinaData.dryRacks) : undefined,
          };
          
          return salesCompsApi.createComp(childPayload as InsertSalesComp);
        });
        
        await Promise.all(childPromises);
        
        return parentComp;
      } catch (error) {
        // Rollback: Delete the parent comp if it was created
        if (parentComp) {
          try {
            await salesCompsApi.deleteComp(parentComp.id);
          } catch (rollbackError) {
            console.error("Failed to rollback parent comp:", rollbackError);
          }
        }
        
        // Re-throw the error so it gets handled by onError
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Portfolio "${portfolioName}" created with ${marinaCount} marinas`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.comps.all });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Portfolio Creation Failed",
        description: `Failed to create portfolio: ${(error as Error).message}. Please try again.`,
        variant: "destructive",
      });
      // Stay on review step so user can retry
    },
  });

  const handleCreatePortfolio = () => {
    createPortfolioMutation.mutate();
  };

  if (!open) return null;

  const progress = (step / 3) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Create New Portfolio</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {step} of 3
            </p>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {/* Step 1: Portfolio Name & Marina Count */}
          {step === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portfolio-name">Portfolio Name *</Label>
                    <Input
                      id="portfolio-name"
                      value={portfolioName}
                      onChange={(e) => setPortfolioName(e.target.value)}
                      placeholder="Enter portfolio name..."
                      data-testid="input-portfolio-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="marina-count">Number of Marinas</Label>
                    <div className="flex gap-2">
                      <Input
                        id="marina-count"
                        type="text"
                        value={marinaCount}
                        onChange={(e) => setMarinaCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                        data-testid="input-marina-count"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddMarina}
                        disabled={marinaCount >= 20}
                        data-testid="button-add-marina"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Marina
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      You can add details for each marina in the next step (max 20)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Enter Marina Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Marina {currentMarinaIndex + 1} of {marinaCount}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {marinaDataList[currentMarinaIndex]?.marinaName || "Unnamed Marina"}
                </p>
              </div>

              <Form {...marinaForm}>
                <form onSubmit={marinaForm.handleSubmit(handleSaveMarina)} className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={marinaForm.control}
                        name="marinaName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Marina Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter marina name..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={marinaForm.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="City" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={marinaForm.control}
                          name="state"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>State</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="State" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={marinaForm.control}
                          name="wetSlips"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Wet Slips</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={marinaForm.control}
                          name="dryRacks"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dry Racks</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Transaction Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={marinaForm.control}
                          name="salePrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Price</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={marinaForm.control}
                          name="capRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cap Rate (%)</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={marinaForm.control}
                          name="noi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>NOI</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="0" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={marinaForm.control}
                          name="saleMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Month</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select month..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {MONTH_NAMES.map((month) => (
                                    <SelectItem key={month} value={month}>
                                      {month}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={marinaForm.control}
                          name="saleYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Year</FormLabel>
                              <FormControl>
                                <Input {...field} type="text" placeholder="YYYY" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </form>
              </Form>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Review Portfolio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Portfolio Name</Label>
                    <p className="text-lg font-semibold">{portfolioName}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Marinas ({marinaCount})</Label>
                    <ul className="mt-2 space-y-2">
                      {marinaDataList.map((marina, index) => (
                        <li key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{marina.marinaName || `Marina ${index + 1}`}</p>
                            <p className="text-sm text-muted-foreground">
                              {marina.city && marina.state ? `${marina.city}, ${marina.state}` : 'Location not specified'}
                            </p>
                          </div>
                          {marina.salePrice && (
                            <p className="text-sm font-medium">
                              ${Number(marina.salePrice).toLocaleString()}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer with navigation buttons */}
        <div className="border-t p-6">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={step === 1 ? handleClose : step === 2 ? handlePreviousMarina : () => setStep(2)}
              disabled={createPortfolioMutation.isPending}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            {step === 1 && (
              <Button onClick={handleStep1Continue}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            {step === 2 && (
              <Button onClick={marinaForm.handleSubmit(handleSaveMarina)}>
                {currentMarinaIndex < marinaCount - 1 ? (
                  <>
                    Next Marina
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Review
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}

            {step === 3 && (
              <Button 
                onClick={handleCreatePortfolio}
                disabled={createPortfolioMutation.isPending}
              >
                {createPortfolioMutation.isPending ? (
                  "Creating..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Portfolio
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
