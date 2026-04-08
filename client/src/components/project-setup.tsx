import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Calendar, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, parseISO } from "date-fns";
import { addBusinessDays } from "@/lib/business-days";
import type { Project, ProjectSettings, Task, Contact } from "@shared/schema";
import { useUpdateProject, useUpdateProjectSettings } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import { KeyContactsSection } from "./key-contacts-section";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  anchorType: z.enum(["psa", "custom"]),
  useBusinessDays: z.boolean(),
  holidayCalendar: z.enum(["us_federal", "none"]),
  tz: z.string(),
  loiSubmittedDate: z.string().optional(),
  loiSignedDate: z.string().optional(),
  daysFromLoiToPsa: z.number().min(1).optional(),
  psaSignedDate: z.string().optional(),
  ddExpirationDate: z.string().optional(),
  closingDate: z.string().optional(),
  // DD Timeline calculation fields
  ddPeriodDays: z.number().min(1, "DD period must be at least 1 day").optional(),
  hasExtensions: z.boolean(),
  extensionCount: z.number().min(0).max(10).optional(),
  extensionDays: z.array(z.number().min(1)).optional(),
  daysToClosing: z.number().min(1, "Days to closing must be at least 1 day").optional(),
  // Key Contacts
  seller: z.array(z.string()).optional(),
  ourAttorney: z.array(z.string()).optional(),
  titleInsuranceCompany: z.string().optional(),
  lender: z.string().optional(),
  // Deposit Information
  firstDepositAmount: z.number().min(0).optional(),
  firstDepositDueDate: z.string().optional(),
  secondDepositAmount: z.number().min(0).optional(),
  secondDepositDueDate: z.string().optional(),
});

const settingsFormSchema = z.object({
  emailReminders: z.boolean(),
  slackNotifications: z.boolean(),
  slackWebhookUrl: z.string().optional(),
  ndaRequired: z.boolean(),
});

interface ProjectSetupProps {
  project: Project;
  settings?: ProjectSettings | null;
  tasks: Task[];
}

export function ProjectSetup({ project, settings, tasks }: ProjectSetupProps) {
  const updateProject = useUpdateProject();
  const updateSettings = useUpdateProjectSettings();
  
  // Fetch contacts for role-based selection
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/dd/contacts'],
  });
  const [extensionDaysArray, setExtensionDaysArray] = useState<number[]>(project.extensionDays || []);
  const [sellersArray, setSellersArray] = useState<string[]>(project.seller || []);
  const [attorneysArray, setAttorneysArray] = useState<string[]>(project.ourAttorney || []);
  
  // Custom Deadlines State
  const [customDeadlines, setCustomDeadlines] = useState<Array<{label: string, date: string, showOnTimeline?: boolean}>>(
    (project.customDeadlines as any) || []
  );
  
  // Deposit Information State
  const [firstDepositDays, setFirstDepositDays] = useState<number | "">(project.firstDepositDays ?? "");
  const [secondDepositDays, setSecondDepositDays] = useState<number | "">(project.secondDepositDays ?? "");
  const [firstDepositUseBusiness, setFirstDepositUseBusiness] = useState<boolean>(false);
  const [secondDepositUseBusiness, setSecondDepositUseBusiness] = useState<boolean>(false);
  const [firstDepositAmount, setFirstDepositAmount] = useState<number | undefined>(
    project.firstDepositAmount || undefined
  );
  const [secondDepositAmount, setSecondDepositAmount] = useState<number | undefined>(
    project.secondDepositAmount || undefined
  );
  
  // Reference dates for calculation (PSA Date, DD Expiration, or manual date)
  const [firstDepositReferenceDate, setFirstDepositReferenceDate] = useState<string>("");
  const [secondDepositReferenceDate, setSecondDepositReferenceDate] = useState<string>("");

  // Helper function to calculate deposit due date from reference date + days
  const calculateDepositDueDate = (referenceDate: string, days: number, useBusinessDays: boolean, holidayCalendar: string) => {
    if (!referenceDate || !days) return "";
    
    try {
      const startDate = parseISO(referenceDate);
      const dueDate = useBusinessDays 
        ? addBusinessDays(startDate, days, holidayCalendar)
        : addDays(startDate, days);
      
      return format(dueDate, 'yyyy-MM-dd');
    } catch {
      return "";
    }
  };

  // Helper function to set quick date selections (sets reference date for calculation)
  const setQuickDate = (depositNumber: 1 | 2, dateType: 'psa' | 'dd') => {
    const referenceDate = dateType === 'psa' ? projectForm.getValues("psaSignedDate") : projectForm.getValues("ddExpirationDate");
    if (referenceDate) {
      if (depositNumber === 1) {
        setFirstDepositReferenceDate(referenceDate);
        // Always set the due date to the reference date first
        projectForm.setValue("firstDepositDueDate", referenceDate);
        // If we have days, calculate and update the due date
        if (firstDepositDays && Number(firstDepositDays) > 0) {
          const calculatedDate = calculateDepositDueDate(referenceDate, Number(firstDepositDays), firstDepositUseBusiness, holidayCalendar);
          if (calculatedDate) {
            projectForm.setValue("firstDepositDueDate", calculatedDate);
          }
        }
      } else {
        setSecondDepositReferenceDate(referenceDate);
        // Always set the due date to the reference date first
        projectForm.setValue("secondDepositDueDate", referenceDate);
        // If we have days, calculate and update the due date
        if (secondDepositDays && Number(secondDepositDays) > 0) {
          const calculatedDate = calculateDepositDueDate(referenceDate, Number(secondDepositDays), secondDepositUseBusiness, holidayCalendar);
          if (calculatedDate) {
            projectForm.setValue("secondDepositDueDate", calculatedDate);
          }
        }
      }
    }
  };

  // Helper function to calculate DD expiration date
  const calculateDDExpirationDate = (psaDate: string, ddPeriodDays: number, extensionDays: number[], useBusinessDays: boolean, holidayCalendar: string) => {
    if (!psaDate || !ddPeriodDays) return "";
    
    try {
      const startDate = parseISO(psaDate);
      let totalDays = ddPeriodDays;
      
      // Add extension days
      if (extensionDays && extensionDays.length > 0) {
        totalDays += extensionDays.reduce((sum, days) => sum + (days || 0), 0);
      }
      
      const expirationDate = useBusinessDays 
        ? addBusinessDays(startDate, totalDays, holidayCalendar)
        : addDays(startDate, totalDays);
      
      return format(expirationDate, 'yyyy-MM-dd');
    } catch {
      return "";
    }
  };

  // Helper function to calculate closing date
  const calculateClosingDate = (ddExpirationDate: string, daysToClosing: number, useBusinessDays: boolean, holidayCalendar: string) => {
    if (!ddExpirationDate || !daysToClosing) return "";
    
    try {
      const expirationDate = parseISO(ddExpirationDate);
      const closingDate = useBusinessDays 
        ? addBusinessDays(expirationDate, daysToClosing, holidayCalendar)
        : addDays(expirationDate, daysToClosing);
      
      return format(closingDate, 'yyyy-MM-dd');
    } catch {
      return "";
    }
  };

  const projectForm = useForm({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: project.name,
      description: project.description || "",
      city: project.city || "",
      state: project.state || "",
      anchorType: project.anchorType,
      useBusinessDays: settings?.useBusinessDays || false,
      holidayCalendar: settings?.holidayCalendar || "us_federal",
      tz: project.tz,
      loiSubmittedDate: (project as any).loiSubmittedDate || "",
      loiSignedDate: (project as any).loiSignedDate || "",
      daysFromLoiToPsa: (project as any).daysFromLoiToPsa ?? undefined,
      psaSignedDate: project.psaSignedDate || "",
      ddExpirationDate: project.ddExpirationDate || "",
      closingDate: project.closingDate || "",
      // DD Timeline fields
      ddPeriodDays: project.ddPeriodDays ?? undefined,
      hasExtensions: project.hasExtensions || false,
      extensionCount: project.extensionCount || 0,
      extensionDays: project.extensionDays || [],
      daysToClosing: project.daysToClosing ?? undefined,
      // Key Contacts
      seller: project.seller || [],
      ourAttorney: project.ourAttorney || [],
      titleInsuranceCompany: project.titleInsuranceCompany || "",
      lender: project.lender || "",
      // Deposit Information
      firstDepositAmount: project.firstDepositAmount || undefined,
      firstDepositDueDate: project.firstDepositDueDate || "",
      secondDepositAmount: project.secondDepositAmount || undefined,
      secondDepositDueDate: project.secondDepositDueDate || "",
    },
  });

  const settingsForm = useForm({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      emailReminders: true, // From notifications JSON
      slackNotifications: false,
      slackWebhookUrl: "",
      ndaRequired: settings?.ndaRequired || false,
    },
  });

  // Sync form with latest project data when project prop changes
  useEffect(() => {
    if (project) {
      // Ensure contact arrays have at least one empty entry for UI editing
      const sellerArray = (project.seller && project.seller.length > 0) ? project.seller : [""];
      const attorneyArray = (project.ourAttorney && project.ourAttorney.length > 0) ? project.ourAttorney : [""];
      
      projectForm.reset({
        name: project.name,
        description: project.description || "",
        city: project.city || "",
        state: project.state || "",
        anchorType: project.anchorType,
        useBusinessDays: settings?.useBusinessDays || false,
        holidayCalendar: settings?.holidayCalendar || "us_federal",
        tz: project.tz,
        psaSignedDate: project.psaSignedDate || "",
        ddExpirationDate: project.ddExpirationDate || "",
        closingDate: project.closingDate || "",
        ddPeriodDays: project.ddPeriodDays ?? undefined,
        hasExtensions: project.hasExtensions || false,
        extensionCount: project.extensionCount || 0,
        extensionDays: project.extensionDays || [],
        daysToClosing: project.daysToClosing ?? undefined,
        seller: sellerArray,
        ourAttorney: attorneyArray,
        titleInsuranceCompany: project.titleInsuranceCompany || "",
        lender: project.lender || "",
        firstDepositAmount: project.firstDepositAmount || undefined,
        firstDepositDueDate: project.firstDepositDueDate || "",
        secondDepositAmount: project.secondDepositAmount || undefined,
        secondDepositDueDate: project.secondDepositDueDate || "",
      });
      // Also sync local state with placeholder handling
      setExtensionDaysArray(project.extensionDays || []);
      setSellersArray(sellerArray);
      setAttorneysArray(attorneyArray);
      setCustomDeadlines((project.customDeadlines as any) || []);
      setFirstDepositAmount(project.firstDepositAmount || undefined);
      setSecondDepositAmount(project.secondDepositAmount || undefined);
      setFirstDepositDays(project.firstDepositDays ?? "");
      setSecondDepositDays(project.secondDepositDays ?? "");
    }
  }, [project.id, project.updatedAt, settings?.useBusinessDays, settings?.holidayCalendar]);

  // Watch form values for automatic calculation
  const loiSignedDate = projectForm.watch("loiSignedDate");
  const daysFromLoiToPsa = projectForm.watch("daysFromLoiToPsa");
  const psaSignedDate = projectForm.watch("psaSignedDate");
  const ddPeriodDays = projectForm.watch("ddPeriodDays");
  const hasExtensions = projectForm.watch("hasExtensions");
  const daysToClosing = projectForm.watch("daysToClosing");
  const useBusinessDays = projectForm.watch("useBusinessDays");
  const holidayCalendar = projectForm.watch("holidayCalendar");

  // Auto-calculate PSA Signed Date from LOI Signed Date + daysFromLoiToPsa
  useEffect(() => {
    if (!loiSignedDate || !daysFromLoiToPsa) return;
    try {
      const loiDate = parseISO(loiSignedDate);
      const psaDate = useBusinessDays
        ? addBusinessDays(loiDate, daysFromLoiToPsa, holidayCalendar || "us_federal")
        : addDays(loiDate, daysFromLoiToPsa);
      const formatted = format(psaDate, 'yyyy-MM-dd');
      if (formatted !== projectForm.getValues("psaSignedDate")) {
        projectForm.setValue("psaSignedDate", formatted);
      }
    } catch { /* invalid date */ }
  }, [loiSignedDate, daysFromLoiToPsa, useBusinessDays, holidayCalendar]);

  // Update deposit due date when reference date or days change
  useEffect(() => {
    if (firstDepositReferenceDate && firstDepositDays && Number(firstDepositDays) > 0) {
      const calculatedDate = calculateDepositDueDate(firstDepositReferenceDate, Number(firstDepositDays), firstDepositUseBusiness, holidayCalendar);
      if (calculatedDate) {
        projectForm.setValue("firstDepositDueDate", calculatedDate);
      }
    }
  }, [firstDepositReferenceDate, firstDepositDays, firstDepositUseBusiness, holidayCalendar]);

  useEffect(() => {
    if (secondDepositReferenceDate && secondDepositDays && Number(secondDepositDays) > 0) {
      const calculatedDate = calculateDepositDueDate(secondDepositReferenceDate, Number(secondDepositDays), secondDepositUseBusiness, holidayCalendar);
      if (calculatedDate) {
        projectForm.setValue("secondDepositDueDate", calculatedDate);
      }
    }
  }, [secondDepositReferenceDate, secondDepositDays, secondDepositUseBusiness, holidayCalendar]);

  // Handle manual date changes - when user directly changes the due date, use it as reference date
  const handleManualDateChange = (depositNumber: 1 | 2, newDate: string) => {
    if (depositNumber === 1) {
      setFirstDepositReferenceDate(newDate);
      projectForm.setValue("firstDepositDueDate", newDate);
    } else {
      setSecondDepositReferenceDate(newDate);
      projectForm.setValue("secondDepositDueDate", newDate);
    }
  };

  // Auto-calculate DD Expiration Date
  useEffect(() => {
    if (psaSignedDate && ddPeriodDays) {
      const extensions = hasExtensions ? extensionDaysArray : [];
      const calculatedDDExpiration = calculateDDExpirationDate(
        psaSignedDate, 
        ddPeriodDays, 
        extensions, 
        useBusinessDays, 
        holidayCalendar
      );
      
      if (calculatedDDExpiration && calculatedDDExpiration !== projectForm.getValues("ddExpirationDate")) {
        projectForm.setValue("ddExpirationDate", calculatedDDExpiration);
      }
    }
  }, [psaSignedDate, ddPeriodDays, hasExtensions, extensionDaysArray, useBusinessDays, holidayCalendar, projectForm]);

  // Auto-calculate Closing Date
  useEffect(() => {
    const ddExpirationDate = projectForm.watch("ddExpirationDate");
    if (ddExpirationDate && daysToClosing) {
      const calculatedClosing = calculateClosingDate(
        ddExpirationDate, 
        daysToClosing, 
        useBusinessDays, 
        holidayCalendar
      );
      
      if (calculatedClosing && calculatedClosing !== projectForm.getValues("closingDate")) {
        projectForm.setValue("closingDate", calculatedClosing);
      }
    }
  }, [projectForm.watch("ddExpirationDate"), daysToClosing, useBusinessDays, holidayCalendar, projectForm]);

  // Helper functions for seller array
  const addSeller = () => {
    const newSellers = [...sellersArray, ""];
    setSellersArray(newSellers);
    projectForm.setValue("seller", newSellers);
  };

  const removeSeller = (index: number) => {
    const newSellers = sellersArray.filter((_, i) => i !== index);
    setSellersArray(newSellers);
    projectForm.setValue("seller", newSellers);
  };

  const updateSeller = (index: number, value: string) => {
    const newSellers = [...sellersArray];
    newSellers[index] = value;
    setSellersArray(newSellers);
    projectForm.setValue("seller", newSellers);
  };

  // Helper functions for attorney array
  const addAttorney = () => {
    const newAttorneys = [...attorneysArray, ""];
    setAttorneysArray(newAttorneys);
    projectForm.setValue("ourAttorney", newAttorneys);
  };

  const removeAttorney = (index: number) => {
    const newAttorneys = attorneysArray.filter((_, i) => i !== index);
    setAttorneysArray(newAttorneys);
    projectForm.setValue("ourAttorney", newAttorneys);
  };

  const updateAttorney = (index: number, value: string) => {
    const newAttorneys = [...attorneysArray];
    newAttorneys[index] = value;
    setAttorneysArray(newAttorneys);
    projectForm.setValue("ourAttorney", newAttorneys);
  };

  const onProjectSubmit = (data: z.infer<typeof projectFormSchema>) => {
    // Update project data
    updateProject.mutate({
      id: project.id,
      updates: {
        name: data.name,
        description: data.description,
        city: data.city,
        state: data.state,
        anchorType: data.anchorType,
        loiSubmittedDate: data.loiSubmittedDate || null,
        loiSignedDate: data.loiSignedDate || null,
        daysFromLoiToPsa: data.daysFromLoiToPsa || null,
        psaSignedDate: data.psaSignedDate || null,
        ddExpirationDate: data.ddExpirationDate || null,
        closingDate: data.closingDate || null,
        // DD Timeline fields
        ddPeriodDays: data.ddPeriodDays || null,
        hasExtensions: data.hasExtensions,
        extensionCount: data.extensionCount || 0,
        extensionDays: data.extensionDays || [],
        daysToClosing: data.daysToClosing || null,
        // Key Contacts - filter out empty strings
        seller: (data.seller || []).filter(s => s.trim() !== ""),
        ourAttorney: (data.ourAttorney || []).filter(a => a.trim() !== ""),
        titleInsuranceCompany: data.titleInsuranceCompany || null,
        lender: data.lender || null,
        // Deposit Information
        firstDepositAmount: firstDepositAmount || null,
        firstDepositDays: firstDepositDays === "" ? null : Number(firstDepositDays),
        firstDepositDueDate: data.firstDepositDueDate || null,
        secondDepositAmount: secondDepositAmount || null,
        secondDepositDays: secondDepositDays === "" ? null : Number(secondDepositDays),
        secondDepositDueDate: data.secondDepositDueDate || null,
        tz: data.tz,
        // Custom Deadlines - filter out empty entries
        customDeadlines: customDeadlines.filter(d => d.label.trim() !== "" && d.date.trim() !== ""),
      },
    });
    
    // Update project settings with business days and holiday calendar
    updateSettings.mutate({
      projectId: project.id,
      settings: {
        useBusinessDays: data.useBusinessDays,
        holidayCalendar: data.holidayCalendar,
        ndaRequired: settings?.ndaRequired || false,
        notificationsJson: settings?.notificationsJson || {
          emailReminders: true,
          slackNotifications: false,
          slackWebhookUrl: "",
        },
      },
    });
  };

  const onSettingsSubmit = (data: z.infer<typeof settingsFormSchema>) => {
    updateSettings.mutate({
      projectId: project.id,
      settings: {
        useBusinessDays: settings?.useBusinessDays || false,
        holidayCalendar: settings?.holidayCalendar || "us_federal",
        ndaRequired: data.ndaRequired,
        notificationsJson: {
          emailReminders: data.emailReminders,
          slackNotifications: data.slackNotifications,
          slackWebhookUrl: data.slackWebhookUrl,
        },
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="project-setup">
      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                {...projectForm.register("name")}
                data-testid="input-project-name"
              />
              {projectForm.formState.errors.name && (
                <p className="text-sm text-destructive">{projectForm.formState.errors.name.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...projectForm.register("description")}
                placeholder="Optional project description"
                data-testid="textarea-description"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  {...projectForm.register("city")}
                  placeholder="Key West"
                  data-testid="input-city"
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  {...projectForm.register("state")}
                  placeholder="FL"
                  data-testid="input-state"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="anchorType">Anchor Type</Label>
              <Select
                value={projectForm.watch("anchorType")}
                onValueChange={(value) => projectForm.setValue("anchorType", value as "psa" | "custom")}
              >
                <SelectTrigger data-testid="select-anchor-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="psa">PSA Signed Date</SelectItem>
                  <SelectItem value="custom">Custom Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="useBusinessDays">Use Business Days</Label>
              <Switch
                id="useBusinessDays"
                checked={projectForm.watch("useBusinessDays")}
                onCheckedChange={(checked) => projectForm.setValue("useBusinessDays", checked)}
                data-testid="switch-business-days"
              />
            </div>
            
            <div>
              <Label htmlFor="holidayCalendar">Holiday Calendar</Label>
              <Select
                value={projectForm.watch("holidayCalendar")}
                onValueChange={(value) => projectForm.setValue("holidayCalendar", value as "us_federal" | "none")}
              >
                <SelectTrigger data-testid="select-holiday-calendar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us_federal">US Federal</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="tz">Project Timezone</Label>
              <Select
                value={projectForm.watch("tz")}
                onValueChange={(value) => projectForm.setValue("tz", value)}
              >
                <SelectTrigger data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Key Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Key Dates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">

            {/* LOI Submitted Date — reference only */}
            <div>
              <Label htmlFor="loiSubmittedDate">LOI Submitted Date <span className="text-xs text-muted-foreground">(reference only)</span></Label>
              <DateInput
                id="loiSubmittedDate"
                value={projectForm.watch("loiSubmittedDate")}
                onChange={(value) => projectForm.setValue("loiSubmittedDate", value)}
              />
            </div>

            {/* LOI Signed Date */}
            <div>
              <Label htmlFor="loiSignedDate">LOI Signed Date</Label>
              <DateInput
                id="loiSignedDate"
                value={projectForm.watch("loiSignedDate")}
                onChange={(value) => {
                  projectForm.setValue("loiSignedDate", value);
                  // Clear auto-computed PSA if LOI date is cleared
                  if (!value) projectForm.setValue("daysFromLoiToPsa", undefined);
                }}
              />
            </div>

            {/* PSA Signed Date — manual entry or computed from LOI + N days */}
            <div>
              <Label htmlFor="psaSignedDate">PSA Signed Date</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput
                  id="psaSignedDate"
                  value={projectForm.watch("psaSignedDate")}
                  onChange={(value) => {
                    projectForm.setValue("psaSignedDate", value);
                    // When user manually sets PSA, clear the LOI-based calculation
                    if (value) projectForm.setValue("daysFromLoiToPsa", undefined);
                  }}
                  data-testid="input-psa-date"
                  placeholder="Select date manually (MM/DD/YYYY)"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">or</span>
                  <Input
                    id="daysFromLoiToPsa"
                    type="number"
                    min="1"
                    placeholder="Days from LOI"
                    {...projectForm.register("daysFromLoiToPsa", { valueAsNumber: true })}
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            </div>

            {/* DD Expiration Date */}
            <div>
              <Label htmlFor="ddExpirationDate">DD Expiration Date</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput
                  id="ddExpirationDate"
                  value={projectForm.watch("ddExpirationDate")}
                  onChange={(value) => projectForm.setValue("ddExpirationDate", value)}
                  data-testid="input-dd-expiration"
                  placeholder="Select date manually (MM/DD/YYYY)"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">or</span>
                  <Input
                    id="ddPeriodDays"
                    type="number"
                    min="1"
                    placeholder="Days from PSA"
                    {...projectForm.register("ddPeriodDays", { valueAsNumber: true })}
                    data-testid="input-dd-period-days"
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              {projectForm.formState.errors.ddPeriodDays && (
                <p className="text-sm text-destructive mt-1">{projectForm.formState.errors.ddPeriodDays.message}</p>
              )}
              
              {/* Extensions */}
              <div className="mt-3 space-y-3">
                <div className="flex items-center space-x-3">
                  <Label htmlFor="hasExtensions" className="text-sm">Extensions?</Label>
                  <Switch
                    id="hasExtensions"
                    checked={projectForm.watch("hasExtensions")}
                    onCheckedChange={(checked) => {
                      projectForm.setValue("hasExtensions", checked);
                      if (!checked) {
                        projectForm.setValue("extensionCount", 0);
                        projectForm.setValue("extensionDays", []);
                        setExtensionDaysArray([]);
                      }
                    }}
                    data-testid="switch-has-extensions"
                  />
                </div>
                
                {projectForm.watch("hasExtensions") && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    <div className="flex items-center space-x-2">
                      <Input
                        id="extensionCount"
                        type="number"
                        min="0"
                        max="10"
                        placeholder="# extensions"
                        {...projectForm.register("extensionCount", { 
                          valueAsNumber: true,
                          onChange: (e) => {
                            const count = parseInt(e.target.value) || 0;
                            const newExtensionDays = Array(count).fill(0).map((_, i) => extensionDaysArray[i] || 0);
                            setExtensionDaysArray(newExtensionDays);
                            projectForm.setValue("extensionDays", newExtensionDays);
                          }
                        })}
                        data-testid="input-extension-count"
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">extensions</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {extensionDaysArray.map((days, index) => (
                        <div key={index} className="flex items-center space-x-1">
                          <span className="text-xs text-muted-foreground">#{index + 1}:</span>
                          <Input
                            id={`extensionDays-${index}`}
                            type="number"
                            min="1"
                            placeholder="days"
                            value={days || ""}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value) || 0;
                              const newArray = [...extensionDaysArray];
                              newArray[index] = newValue;
                              setExtensionDaysArray(newArray);
                              projectForm.setValue("extensionDays", newArray);
                            }}
                            data-testid={`input-extension-days-${index}`}
                            className="w-20"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Closing Date */}
            <div>
              <Label htmlFor="closingDate">Closing Date</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput
                  id="closingDate"
                  value={projectForm.watch("closingDate")}
                  onChange={(value) => projectForm.setValue("closingDate", value)}
                  data-testid="input-closing-date"
                  placeholder="Select date manually (MM/DD/YYYY)"
                />
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">or</span>
                  <Input
                    id="daysToClosing"
                    type="number"
                    min="1"
                    placeholder="Days after DD"
                    {...projectForm.register("daysToClosing", { valueAsNumber: true })}
                    data-testid="input-days-to-closing"
                    className="w-40"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
              {projectForm.formState.errors.daysToClosing && (
                <p className="text-sm text-destructive mt-1">{projectForm.formState.errors.daysToClosing.message}</p>
              )}
            </div>
            
            {/* Custom Deadlines */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Custom Deadlines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomDeadlines([...customDeadlines, { label: "", date: "", showOnTimeline: false }]);
                  }}
                  data-testid="button-add-custom-deadline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Deadline
                </Button>
              </div>
              
              {customDeadlines.length > 0 && (
                <div className="space-y-3">
                  {customDeadlines.map((deadline, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div className="space-y-2">
                          <Label htmlFor={`custom-deadline-label-${index}`} className="text-xs">Deadline Name</Label>
                          <Input
                            id={`custom-deadline-label-${index}`}
                            value={deadline.label}
                            onChange={(e) => {
                              const updated = [...customDeadlines];
                              updated[index].label = e.target.value;
                              setCustomDeadlines(updated);
                            }}
                            placeholder="e.g., Inspection Period, Final Walkthrough"
                            data-testid={`input-custom-deadline-label-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`custom-deadline-date-${index}`} className="text-xs">Date</Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const updated = customDeadlines.filter((_, i) => i !== index);
                                setCustomDeadlines(updated);
                              }}
                              className="h-6 w-6 p-0"
                              data-testid={`button-remove-custom-deadline-${index}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <DateInput
                            id={`custom-deadline-date-${index}`}
                            value={deadline.date}
                            onChange={(value) => {
                              const updated = [...customDeadlines];
                              updated[index].date = value;
                              setCustomDeadlines(updated);
                            }}
                            data-testid={`input-custom-deadline-date-${index}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`custom-deadline-timeline-${index}`}
                            checked={deadline.showOnTimeline ?? false}
                            onCheckedChange={(checked) => {
                              const updated = [...customDeadlines];
                              updated[index].showOnTimeline = checked;
                              setCustomDeadlines(updated);
                            }}
                            data-testid={`switch-custom-deadline-timeline-${index}`}
                          />
                          <Label htmlFor={`custom-deadline-timeline-${index}`} className="text-xs font-normal cursor-pointer">
                            Show on main timeline progress bar
                          </Label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {customDeadlines.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No custom deadlines added. Click "Add New Deadline" to create one.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Contacts */}
      <KeyContactsSection projectId={project.id} />

      {/* Deposit Information */}
      <Card>
        <CardHeader>
          <CardTitle>Deposit Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* 1st Deposit */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-700">1st Deposit</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstDepositAmount">Amount</Label>
                  <CurrencyInput
                    id="firstDepositAmount"
                    value={firstDepositAmount}
                    onValueChange={setFirstDepositAmount}
                    data-testid="input-first-deposit-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="firstDepositDueDate">Due Date</Label>
                  <div className="space-y-2">
                    <Input
                      id="firstDepositDueDate"
                      type="date"
                      value={projectForm.watch("firstDepositDueDate") || ""}
                      onChange={(e) => {
                        handleManualDateChange(1, e.target.value);
                      }}
                      data-testid="input-first-deposit-due-date"
                    />
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickDate(1, 'psa')}
                        className="flex-1 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        PSA Date
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickDate(1, 'dd')}
                        className="flex-1 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        DD Expiration
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstDepositDays">Within # of Days</Label>
                  <Input
                    id="firstDepositDays"
                    type="number"
                    value={firstDepositDays === 0 ? "" : firstDepositDays}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFirstDepositDays(value === "" ? "" : Number(value));
                    }}
                    placeholder="Enter days"
                    min="0"
                    data-testid="input-first-deposit-days"
                  />
                </div>
                <div>
                  <Label htmlFor="firstDepositDayType">Day Type</Label>
                  <Select
                    value={firstDepositUseBusiness ? "business" : "calendar"}
                    onValueChange={(value) => setFirstDepositUseBusiness(value === "business")}
                  >
                    <SelectTrigger data-testid="select-first-deposit-day-type">
                      <SelectValue>
                        <div className="flex items-center">
                          {firstDepositUseBusiness ? (
                            <><Clock className="h-4 w-4 mr-2" />Business Days</>
                          ) : (
                            <><Calendar className="h-4 w-4 mr-2" />Calendar Days</>
                          )}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Calendar Days
                        </div>
                      </SelectItem>
                      <SelectItem value="business">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Business Days
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            <div className="border-t pt-4" />
            
            {/* 2nd Deposit */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-medium text-gray-700">2nd Deposit</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="secondDepositAmount">Amount</Label>
                  <CurrencyInput
                    id="secondDepositAmount"
                    value={secondDepositAmount}
                    onValueChange={setSecondDepositAmount}
                    data-testid="input-second-deposit-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="secondDepositDueDate">Due Date</Label>
                  <div className="space-y-2">
                    <Input
                      id="secondDepositDueDate"
                      type="date"
                      value={projectForm.watch("secondDepositDueDate") || ""}
                      onChange={(e) => {
                        handleManualDateChange(2, e.target.value);
                      }}
                      data-testid="input-second-deposit-due-date"
                    />
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickDate(2, 'psa')}
                        className="flex-1 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        PSA Date
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setQuickDate(2, 'dd')}
                        className="flex-1 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        DD Expiration
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="secondDepositDays">Within # of Days</Label>
                  <Input
                    id="secondDepositDays"
                    type="number"
                    value={secondDepositDays === 0 ? "" : secondDepositDays}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSecondDepositDays(value === "" ? "" : Number(value));
                    }}
                    placeholder="Enter days"
                    min="0"
                    data-testid="input-second-deposit-days"
                  />
                </div>
                <div>
                  <Label htmlFor="secondDepositDayType">Day Type</Label>
                  <Select
                    value={secondDepositUseBusiness ? "business" : "calendar"}
                    onValueChange={(value) => setSecondDepositUseBusiness(value === "business")}
                  >
                    <SelectTrigger data-testid="select-second-deposit-day-type">
                      <SelectValue>
                        <div className="flex items-center">
                          {secondDepositUseBusiness ? (
                            <><Clock className="h-4 w-4 mr-2" />Business Days</>
                          ) : (
                            <><Calendar className="h-4 w-4 mr-2" />Calendar Days</>
                          )}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2" />
                          Calendar Days
                        </div>
                      </SelectItem>
                      <SelectItem value="business">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          Business Days
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications - Full width on second row */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="emailReminders">Email Reminders</Label>
              <Switch
                id="emailReminders"
                checked={settingsForm.watch("emailReminders")}
                onCheckedChange={(checked) => settingsForm.setValue("emailReminders", checked)}
                data-testid="switch-email-reminders"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="slackNotifications">Slack Notifications</Label>
              <Switch
                id="slackNotifications"
                checked={settingsForm.watch("slackNotifications")}
                onCheckedChange={(checked) => settingsForm.setValue("slackNotifications", checked)}
                data-testid="switch-slack-notifications"
              />
            </div>
            
            <div>
              <Label htmlFor="slackWebhookUrl">Slack Webhook URL</Label>
              <Input
                id="slackWebhookUrl"
                type="url"
                {...settingsForm.register("slackWebhookUrl")}
                placeholder="https://hooks.slack.com/..."
                data-testid="input-slack-webhook"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="ndaRequired">NDA Required for Sharing</Label>
              <Switch
                id="ndaRequired"
                checked={settingsForm.watch("ndaRequired")}
                onCheckedChange={(checked) => settingsForm.setValue("ndaRequired", checked)}
                data-testid="switch-nda-required"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="lg:col-span-2 flex justify-end space-x-3">
        <Button variant="outline" data-testid="button-cancel">
          Cancel
        </Button>
        <Button 
          onClick={() => {
            projectForm.handleSubmit(onProjectSubmit)();
            settingsForm.handleSubmit(onSettingsSubmit)();
          }}
          data-testid="button-save-project"
        >
          Save Project
        </Button>
      </div>
    </div>
  );
}
