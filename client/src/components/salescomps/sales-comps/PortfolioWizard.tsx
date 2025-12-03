import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { X, ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { salesCompsApi } from '@/lib/salescomps/api';
import { queryKeys } from '@/lib/salescomps/queryKeys';
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import type { SalesComp, InsertSalesComp } from "@shared/schema";
import { PROFIT_CENTERS, WATER_TYPES, STORAGE_TYPES, US_REGIONS } from "@shared/salescomps-constants";
import { AddressInput } from "@/components/address-input";
import { useCustomStorageTypes, useCreateCustomStorageType } from "@/hooks/salescomps/useCustomStorageTypes";

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

// Comprehensive schema matching Add Sales Comp modal
const marinaDataSchema = z.object({
  marinaName: z.string().min(1, "Marina name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  wetSlips: z.union([z.string(), z.number()]).optional(),
  dryRacks: z.union([z.string(), z.number()]).optional(),
  acres: z.union([z.string(), z.number()]).optional(),
  yearBuilt: z.union([z.string(), z.number()]).optional(),
  storageTypes: z.array(z.string()).default([]),
  salePrice: z.union([z.string(), z.number()]).optional(),
  isPriceDisclosed: z.boolean().default(true),
  listPrice: z.union([z.string(), z.number()]).optional(),
  estimatedPurchasePrice: z.union([z.string(), z.number()]).optional(),
  noi: z.union([z.string(), z.number()]).optional(),
  isNoiDisclosed: z.boolean().default(true),
  capRate: z.union([z.string(), z.number()]).optional(),
  isCapRateDisclosed: z.boolean().default(true),
  occupancy: z.union([z.string(), z.number()]).optional(),
  daysOnMarket: z.union([z.string(), z.number()]).optional(),
  saleMonth: z.union([z.string(), z.number()]).optional(),
  saleYear: z.union([z.string(), z.number()]).optional(),
  saleCondition: z.string().optional(),
  brokerage: z.string().optional(),
  agentFirstName: z.string().optional(),
  agentLastName: z.string().optional(),
  sellerCompany: z.string().optional(),
  sellerPrincipal: z.string().optional(),
  buyerCompany: z.string().optional(),
  buyerPrincipal: z.string().optional(),
  waterType: z.string().optional(),
  waterBodyName: z.string().optional(),
  region: z.string().optional(),
  profitCenterStorage: z.boolean().default(false),
  profitCenterEvents: z.boolean().default(false),
  profitCenterService: z.boolean().default(false),
  profitCenterThirdPartyLeases: z.boolean().default(false),
  profitCenterBoatRentals: z.boolean().default(false),
  profitCenterBoatBrokerage: z.boolean().default(false),
  profitCenterRvPark: z.boolean().default(false),
  profitCenterFuel: z.boolean().default(false),
  profitCenterShipStore: z.boolean().default(false),
  profitCenterParts: z.boolean().default(false),
  profitCenterBoatClub: z.boolean().default(false),
  profitCenterBoatSales: z.boolean().default(false),
  profitCenterFnb: z.boolean().default(false),
  profitCenterHospitality: z.boolean().default(false),
  profitCenterBoatRentalsType: z.string().optional(),
  profitCenterBoatBrokerageType: z.string().optional(),
  profitCenterFuelType: z.string().optional(),
  profitCenterShipStoreType: z.string().optional(),
  profitCenterPartsType: z.string().optional(),
  profitCenterBoatSalesType: z.string().optional(),
  profitCenterFnbType: z.string().optional(),
  profitCenterHospitalityType: z.string().optional(),
  profitCenterBoatClubType: z.string().optional(),
  profitCenterBoatClubCompany: z.string().optional(),
  articleUrls: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

type MarinaData = z.infer<typeof marinaDataSchema>;

// Empty marina template - ensures all fields start blank
const emptyMarina: MarinaData = {
  marinaName: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  wetSlips: "",
  dryRacks: "",
  acres: "",
  yearBuilt: "",
  storageTypes: [],
  salePrice: "",
  isPriceDisclosed: true,
  listPrice: "",
  estimatedPurchasePrice: "",
  noi: "",
  isNoiDisclosed: true,
  capRate: "",
  isCapRateDisclosed: true,
  occupancy: "",
  daysOnMarket: "",
  saleMonth: "",
  saleYear: "",
  saleCondition: "",
  brokerage: "",
  agentFirstName: "",
  agentLastName: "",
  sellerCompany: "",
  sellerPrincipal: "",
  buyerCompany: "",
  buyerPrincipal: "",
  waterType: "",
  waterBodyName: "",
  region: "",
  profitCenterStorage: false,
  profitCenterEvents: false,
  profitCenterService: false,
  profitCenterThirdPartyLeases: false,
  profitCenterBoatRentals: false,
  profitCenterBoatBrokerage: false,
  profitCenterRvPark: false,
  profitCenterFuel: false,
  profitCenterShipStore: false,
  profitCenterParts: false,
  profitCenterBoatClub: false,
  profitCenterBoatSales: false,
  profitCenterFnb: false,
  profitCenterHospitality: false,
  profitCenterBoatRentalsType: "",
  profitCenterBoatBrokerageType: "",
  profitCenterFuelType: "",
  profitCenterShipStoreType: "",
  profitCenterPartsType: "",
  profitCenterBoatSalesType: "",
  profitCenterFnbType: "",
  profitCenterHospitalityType: "",
  profitCenterBoatClubType: "",
  profitCenterBoatClubCompany: "",
  articleUrls: [],
  notes: "",
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
  const [articleUrls, setArticleUrls] = useState<string[]>([""]);
  const [newStorageTypeName, setNewStorageTypeName] = useState("");

  // Fetch custom storage types
  const { data: customStorageTypes = [] } = useCustomStorageTypes();
  const createCustomStorageType = useCreateCustomStorageType();

  // Merge predefined and custom storage types
  const allStorageTypes = [...STORAGE_TYPES, ...customStorageTypes.map(t => t.name)];
  
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
    // Update marina data list - merge with emptyMarina to ensure full object and sync articleUrls
    const updated = [...marinaDataList];
    updated[currentMarinaIndex] = { 
      ...emptyMarina, 
      ...data,
      articleUrls: articleUrls.filter(url => url.trim() !== "")
    };
    setMarinaDataList(updated);

    // Move to next marina or to review step
    if (currentMarinaIndex < marinaCount - 1) {
      const nextIndex = currentMarinaIndex + 1;
      setCurrentMarinaIndex(nextIndex);
      // Merge with emptyMarina to ensure blank fields for new marina or saved data for visited marina
      const nextMarinaData = { ...emptyMarina, ...updated[nextIndex] };
      marinaForm.reset(nextMarinaData);
      // Update articleUrls state for the next marina
      setArticleUrls(nextMarinaData.articleUrls && nextMarinaData.articleUrls.length > 0 ? nextMarinaData.articleUrls : [""]);
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
      const prevMarinaData = { ...emptyMarina, ...marinaDataList[prevIndex] };
      marinaForm.reset(prevMarinaData);
      // Update articleUrls state for the previous marina
      setArticleUrls(prevMarinaData.articleUrls && prevMarinaData.articleUrls.length > 0 ? prevMarinaData.articleUrls : [""]);
    } else {
      setStep(1);
    }
  };

  // Article URL management
  const addArticleUrl = () => {
    setArticleUrls([...articleUrls, ""]);
  };

  const removeArticleUrl = (index: number) => {
    setArticleUrls(articleUrls.filter((_, i) => i !== index));
  };

  const updateArticleUrl = (index: number, value: string) => {
    const updated = [...articleUrls];
    updated[index] = value;
    setArticleUrls(updated);
  };

  // Storage type management
  const handleAddCustomStorageType = async () => {
    if (!newStorageTypeName.trim()) return;
    
    try {
      await createCustomStorageType.mutateAsync({ name: newStorageTypeName.trim() });
      toast({
        title: "Success",
        description: "Custom storage type created",
      });
      setNewStorageTypeName("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create custom storage type",
        variant: "destructive",
      });
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
            // Identity
            address: marinaData.address || undefined,
            city: marinaData.city || undefined,
            state: marinaData.state || undefined,
            zip: marinaData.zip || undefined,
            // Physical Characteristics
            wetSlips: marinaData.wetSlips ? Number(marinaData.wetSlips) : undefined,
            dryRacks: marinaData.dryRacks ? Number(marinaData.dryRacks) : undefined,
            acres: marinaData.acres ? Number(marinaData.acres) : undefined,
            yearBuilt: marinaData.yearBuilt ? Number(marinaData.yearBuilt) : undefined,
            storageTypes: marinaData.storageTypes || [],
            // Financial Information
            salePrice: marinaData.salePrice ? Number(marinaData.salePrice) : undefined,
            isPriceDisclosed: marinaData.isPriceDisclosed,
            listPrice: marinaData.listPrice ? Number(marinaData.listPrice) : undefined,
            estimatedPurchasePrice: marinaData.estimatedPurchasePrice ? Number(marinaData.estimatedPurchasePrice) : undefined,
            noi: marinaData.noi ? Number(marinaData.noi) : undefined,
            isNoiDisclosed: marinaData.isNoiDisclosed,
            capRate: marinaData.capRate ? Number(marinaData.capRate) : undefined,
            isCapRateDisclosed: marinaData.isCapRateDisclosed,
            occupancy: marinaData.occupancy ? Number(marinaData.occupancy) : undefined,
            daysOnMarket: marinaData.daysOnMarket ? Number(marinaData.daysOnMarket) : undefined,
            // Sale Information
            saleMonth: marinaData.saleMonth ? Number(marinaData.saleMonth) : undefined,
            saleYear: marinaData.saleYear ? Number(marinaData.saleYear) : undefined,
            saleCondition: marinaData.saleCondition || undefined,
            brokerage: marinaData.brokerage || undefined,
            agentFirstName: marinaData.agentFirstName || undefined,
            agentLastName: marinaData.agentLastName || undefined,
            // Transaction Parties
            sellerCompany: marinaData.sellerCompany || undefined,
            sellerPrincipal: marinaData.sellerPrincipal || undefined,
            buyerCompany: marinaData.buyerCompany || undefined,
            buyerPrincipal: marinaData.buyerPrincipal || undefined,
            // Profit Centers & Location
            waterType: marinaData.waterType || undefined,
            coastalType: marinaData.waterType || undefined, // Sync for backward compatibility
            waterBodyName: marinaData.waterBodyName || undefined,
            region: marinaData.region || undefined,
            profitCenterStorage: marinaData.profitCenterStorage,
            profitCenterEvents: marinaData.profitCenterEvents,
            profitCenterService: marinaData.profitCenterService,
            profitCenterThirdPartyLeases: marinaData.profitCenterThirdPartyLeases,
            profitCenterBoatRentals: marinaData.profitCenterBoatRentals,
            profitCenterBoatBrokerage: marinaData.profitCenterBoatBrokerage,
            profitCenterRvPark: marinaData.profitCenterRvPark,
            profitCenterFuel: marinaData.profitCenterFuel,
            profitCenterShipStore: marinaData.profitCenterShipStore,
            profitCenterParts: marinaData.profitCenterParts,
            profitCenterBoatClub: marinaData.profitCenterBoatClub,
            profitCenterBoatSales: marinaData.profitCenterBoatSales,
            profitCenterFnb: marinaData.profitCenterFnb,
            profitCenterHospitality: marinaData.profitCenterHospitality,
            profitCenterBoatRentalsType: marinaData.profitCenterBoatRentalsType || undefined,
            profitCenterBoatBrokerageType: marinaData.profitCenterBoatBrokerageType || undefined,
            profitCenterFuelType: marinaData.profitCenterFuelType || undefined,
            profitCenterShipStoreType: marinaData.profitCenterShipStoreType || undefined,
            profitCenterPartsType: marinaData.profitCenterPartsType || undefined,
            profitCenterBoatSalesType: marinaData.profitCenterBoatSalesType || undefined,
            profitCenterFnbType: marinaData.profitCenterFnbType || undefined,
            profitCenterHospitalityType: marinaData.profitCenterHospitalityType || undefined,
            profitCenterBoatClubType: marinaData.profitCenterBoatClubType || undefined,
            profitCenterBoatClubCompany: marinaData.profitCenterBoatClubCompany || undefined,
            // Notes & Documentation
            articleUrls: marinaData.articleUrls?.filter(url => url.trim() !== "") || [],
            notes: marinaData.notes || undefined,
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
                  <div className="grid grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                      {/* Identity Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Identity</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={marinaForm.control}
                            name="marinaName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Marina Name *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Enter marina name..."
                                    data-testid="input-marina-name"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={marinaForm.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <AddressInput
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    onAddressSelect={(components) => {
                                      if (components.city) marinaForm.setValue("city", components.city);
                                      if (components.state) marinaForm.setValue("state", components.state);
                                      if (components.zipCode) marinaForm.setValue("zip", components.zipCode);
                                    }}
                                    label="Address"
                                    placeholder="Enter full address..."
                                    testId="input-address"
                                    countries={['us', 'ca']}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-3 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="San Diego"
                                      data-testid="input-city"
                                    />
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
                                    <Input 
                                      {...field} 
                                      placeholder="CA"
                                      maxLength={50}
                                      data-testid="input-state"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="zip"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Zip</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="92101"
                                      data-testid="input-zip"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Physical Characteristics */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Physical Characteristics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="wetSlips"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Wet Slips</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="156"
                                      data-testid="input-wet-slips"
                                    />
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
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="89"
                                      data-testid="input-dry-racks"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="acres"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Acres</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="12.5"
                                      data-testid="input-acres"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="yearBuilt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Year Built</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="1987"
                                      data-testid="input-year-built"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={marinaForm.control}
                            name="storageTypes"
                            render={() => (
                              <FormItem>
                                <FormLabel>Storage Types</FormLabel>
                                
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  {allStorageTypes.map((type) => (
                                    <FormField
                                      key={type}
                                      control={marinaForm.control}
                                      name="storageTypes"
                                      render={({ field }) => {
                                        return (
                                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                            <FormControl>
                                              <Checkbox
                                                checked={field.value?.includes(type)}
                                                onCheckedChange={(checked) => {
                                                  const updated = checked
                                                    ? [...(field.value || []), type]
                                                    : (field.value || []).filter((val) => val !== type);
                                                  field.onChange(updated);
                                                }}
                                                data-testid={`checkbox-storage-${type.toLowerCase().replace(/\s+/g, '-')}`}
                                              />
                                            </FormControl>
                                            <FormLabel className="text-sm font-normal">
                                              {type}
                                            </FormLabel>
                                          </FormItem>
                                        );
                                      }}
                                    />
                                  ))}
                                </div>

                                <div className="flex gap-2 mt-3">
                                  <Input
                                    placeholder="Add new storage type..."
                                    value={newStorageTypeName}
                                    onChange={(e) => setNewStorageTypeName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomStorageType();
                                      }
                                    }}
                                    data-testid="input-new-storage-type"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleAddCustomStorageType}
                                    disabled={!newStorageTypeName.trim() || createCustomStorageType.isPending}
                                    data-testid="button-add-storage-type"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      {/* Financial Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Financial Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="salePrice"
                              render={({ field }) => {
                                const isPriceUndisclosed = !marinaForm.watch("isPriceDisclosed");
                                return (
                                  <FormItem>
                                    <FormLabel>Sale Price</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field}
                                        value={isPriceUndisclosed ? "N/A" : field.value}
                                        type="text"
                                        placeholder="12500000"
                                        disabled={isPriceUndisclosed}
                                        data-testid="input-sale-price"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="listPrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>List Price</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="13750000"
                                      data-testid="input-list-price"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="estimatedPurchasePrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Estimated Purchase Price</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="12000000"
                                      data-testid="input-estimated-purchase-price"
                                    />
                                  </FormControl>
                                  <p className="text-xs text-muted-foreground mt-1">Broker estimate when actual price unavailable</p>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div /> {/* Empty space for grid alignment */}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="noi"
                              render={({ field }) => {
                                const isNoiUndisclosed = !marinaForm.watch("isNoiDisclosed");
                                return (
                                  <FormItem>
                                    <FormLabel>NOI</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field}
                                        value={isNoiUndisclosed ? "N/A" : field.value}
                                        type="text"
                                        placeholder="900000"
                                        disabled={isNoiUndisclosed}
                                        data-testid="input-noi"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="capRate"
                              render={({ field }) => {
                                const isCapRateUndisclosed = !marinaForm.watch("isCapRateDisclosed");
                                return (
                                  <FormItem>
                                    <FormLabel>Cap Rate (%)</FormLabel>
                                    <FormControl>
                                      <Input 
                                        {...field}
                                        value={isCapRateUndisclosed ? "N/A" : field.value}
                                        type="text"
                                        placeholder="7.2"
                                        disabled={isCapRateUndisclosed}
                                        data-testid="input-cap-rate"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                );
                              }}
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="occupancy"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Occupancy (%)</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="94.2"
                                      data-testid="input-occupancy"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="daysOnMarket"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Days on Market</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="127"
                                      data-testid="input-days-on-market"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <FormField
                              control={marinaForm.control}
                              name="isPriceDisclosed"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={!field.value}
                                      onCheckedChange={(checked) => field.onChange(!checked)}
                                      data-testid="checkbox-price-undisclosed"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    Price Undisclosed
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="isCapRateDisclosed"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={!field.value}
                                      onCheckedChange={(checked) => field.onChange(!checked)}
                                      data-testid="checkbox-cap-rate-undisclosed"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    Cap Rate Undisclosed
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="isNoiDisclosed"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={!field.value}
                                      onCheckedChange={(checked) => field.onChange(!checked)}
                                      data-testid="checkbox-noi-undisclosed"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    NOI Undisclosed
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Sale Information */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Sale Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={marinaForm.control}
                              name="saleMonth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sale Month</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-sale-month">
                                        <SelectValue placeholder="Select month" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">None</SelectItem>
                                      {Array.from({ length: 12 }, (_, i) => {
                                        const month = new Date(0, i).toLocaleString('en', { month: 'long' });
                                        return (
                                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                                            {month}
                                          </SelectItem>
                                        );
                                      })}
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
                                    <Input 
                                      {...field} 
                                      type="text"
                                      placeholder="2024"
                                      data-testid="input-sale-year"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={marinaForm.control}
                            name="saleCondition"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Sale Condition</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Good condition"
                                    data-testid="input-sale-condition"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={marinaForm.control}
                            name="brokerage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Brokerage</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="e.g., Transworld Business Advisors"
                                    data-testid="input-brokerage"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={marinaForm.control}
                              name="agentFirstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Agent First Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="First name"
                                      data-testid="input-agent-first-name"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={marinaForm.control}
                              name="agentLastName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Agent Last Name</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="Last name"
                                      data-testid="input-agent-last-name"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Transaction Parties */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Transaction Parties</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-6">
                        {/* Seller Section */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-gray-700">Seller</h4>
                          <FormField
                            control={marinaForm.control}
                            name="sellerCompany"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Seller company name"
                                    data-testid="input-seller-company"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marinaForm.control}
                            name="sellerPrincipal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Principal</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Principal contact name"
                                    data-testid="input-seller-principal"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Buyer Section */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-gray-700">Buyer</h4>
                          <FormField
                            control={marinaForm.control}
                            name="buyerCompany"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Buyer company name"
                                    data-testid="input-buyer-company"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={marinaForm.control}
                            name="buyerPrincipal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Principal</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="Principal contact name"
                                    data-testid="input-buyer-principal"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profit Centers & Location */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Profit Centers & Location</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={marinaForm.control}
                        name="waterType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Water Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-water-type">
                                  <SelectValue placeholder="Select water type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none-selected">Select water type</SelectItem>
                                {WATER_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
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
                        name="waterBodyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Water Body Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g., Gulf of America, Lake Superior" data-testid="input-water-body-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={marinaForm.control}
                        name="region"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-region">
                                  <SelectValue placeholder="Select region" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="none-selected">Select region</SelectItem>
                                {US_REGIONS.map((region) => (
                                  <SelectItem key={region} value={region}>
                                    {region}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Enhanced Profit Center Checkboxes with Operation Types */}
                      <div>
                        <FormLabel className="text-base font-semibold">Profit Centers</FormLabel>
                        <div className="space-y-4 mt-3">
                          {/* Simple profit centers without operation types */}
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { key: 'profitCenterStorage', label: 'Storage' },
                              { key: 'profitCenterEvents', label: 'Events' },
                              { key: 'profitCenterService', label: 'Service' },
                              { key: 'profitCenterThirdPartyLeases', label: 'Third-Party Leases' },
                              { key: 'profitCenterRvPark', label: 'RV Park' },
                            ].map((profitCenter) => (
                              <FormField
                                key={profitCenter.key}
                                control={marinaForm.control}
                                name={profitCenter.key as keyof MarinaData}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value === true}
                                        onCheckedChange={(checked) => field.onChange(checked === true)}
                                        data-testid={`checkbox-${profitCenter.key.toLowerCase()}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {profitCenter.label}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>

                          {/* Profit centers with In-House/Leased operation types */}
                          {[
                            { key: 'profitCenterBoatRentals', typeKey: 'profitCenterBoatRentalsType', label: 'Boat Rentals' },
                            { key: 'profitCenterBoatBrokerage', typeKey: 'profitCenterBoatBrokerageType', label: 'Boat Brokerage' },
                            { key: 'profitCenterFuel', typeKey: 'profitCenterFuelType', label: 'Fuel' },
                            { key: 'profitCenterShipStore', typeKey: 'profitCenterShipStoreType', label: 'Ship Store' },
                            { key: 'profitCenterParts', typeKey: 'profitCenterPartsType', label: 'Parts' },
                            { key: 'profitCenterBoatSales', typeKey: 'profitCenterBoatSalesType', label: 'Boat Sales' },
                            { key: 'profitCenterFnb', typeKey: 'profitCenterFnbType', label: 'F&B' },
                            { key: 'profitCenterHospitality', typeKey: 'profitCenterHospitalityType', label: 'Hospitality/Accommodations' },
                          ].map((profitCenter) => (
                            <div key={profitCenter.key} className="space-y-2">
                              <FormField
                                control={marinaForm.control}
                                name={profitCenter.key as keyof MarinaData}
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value === true}
                                        onCheckedChange={(checked) => field.onChange(checked === true)}
                                        data-testid={`checkbox-${profitCenter.key.toLowerCase()}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {profitCenter.label}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                              {marinaForm.watch(profitCenter.key as keyof MarinaData) && (
                                <div className="ml-6">
                                  <FormField
                                    control={marinaForm.control}
                                    name={profitCenter.typeKey as keyof MarinaData}
                                    render={({ field }) => (
                                      <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                          <FormControl>
                                            <SelectTrigger className="w-40" data-testid={`select-${profitCenter.typeKey.toLowerCase()}`}>
                                              <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="none">Select type</SelectItem>
                                            <SelectItem value="in-house">In-House</SelectItem>
                                            <SelectItem value="leased">Leased</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Boat Club with special In-House/Third-Party selector and company name */}
                          <div className="space-y-2">
                            <FormField
                              control={marinaForm.control}
                              name="profitCenterBoatClub"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value === true}
                                      onCheckedChange={(checked) => field.onChange(checked === true)}
                                      data-testid="checkbox-profitcenterboatclub"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    Boat Club
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                            {marinaForm.watch('profitCenterBoatClub') && (
                              <div className="ml-6 space-y-3">
                                <FormField
                                  control={marinaForm.control}
                                  name="profitCenterBoatClubType"
                                  render={({ field }) => (
                                    <FormItem>
                                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                                        <FormControl>
                                          <SelectTrigger className="w-40" data-testid="select-profitcenterboatclubtype">
                                            <SelectValue placeholder="Select type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="none">Select type</SelectItem>
                                          <SelectItem value="in-house">In-House</SelectItem>
                                          <SelectItem value="third-party">Third-Party</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />
                                {marinaForm.watch('profitCenterBoatClubType') === 'third-party' && (
                                  <FormField
                                    control={marinaForm.control}
                                    name="profitCenterBoatClubCompany"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel className="text-sm">Company Name</FormLabel>
                                        <FormControl>
                                          <Input 
                                            {...field} 
                                            placeholder="Enter company name"
                                            className="w-64"
                                            data-testid="input-profitcenterboatclubcompany"
                                          />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Notes & Documentation */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Notes & Documentation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Article URLs</Label>
                        <div className="space-y-2 mt-2">
                          {articleUrls.map((url, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                value={url}
                                onChange={(e) => updateArticleUrl(index, e.target.value)}
                                placeholder="https://example.com/article"
                                data-testid={`input-article-url-${index}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeArticleUrl(index)}
                                data-testid={`button-remove-article-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addArticleUrl}
                            data-testid="button-add-article-url"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add URL
                          </Button>
                        </div>
                      </div>
                      
                      <FormField
                        control={marinaForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                rows={3}
                                placeholder="Marina was recently renovated with new docks and electrical systems..."
                                data-testid="textarea-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
