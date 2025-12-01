import { useState, useEffect, FormEvent, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Customer, Boat, Launch } from "@shared/schema";

interface LaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LaunchModal({ isOpen, onClose }: LaunchModalProps) {
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedBoat, setSelectedBoat] = useState("");
  const [launchTime, setLaunchTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isCreatingNewCustomer, setIsCreatingNewCustomer] = useState(false);
  const [isAddingNewBoat, setIsAddingNewBoat] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  
  // New customer form fields
  const [newCustomer, setNewCustomer] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    emergencyContact: { name: "", phone: "", relationship: "" }
  });
  
  // New boat form fields
  const [newBoat, setNewBoat] = useState({
    name: "",
    make: "",
    model: "",
    year: new Date().getFullYear(),
    length: "",
    beam: ""
  });

  const { toast } = useToast();

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: boats = [] } = useQuery<Boat[]>({
    queryKey: ['/api/boats'],
    enabled: !!selectedCustomer && !isCreatingNewCustomer,
  });

  // Fetch all launches to check for conflicts
  const { data: allLaunches = [], isLoading: launchesLoading, isFetching: launchesFetching } = useQuery<Launch[]>({
    queryKey: ['/api/launches'],
    enabled: !!launchTime && !isCreatingNewCustomer,
  });

  const customerBoats = boats.filter(boat => boat.customerId === selectedCustomer);
  
  // Filter out boats that are already scheduled for launch at overlapping times
  const availableBoats = launchTime ? customerBoats.filter(boat => {
    const selectedDateTime = new Date(launchTime);
    const bufferHours = 1; // 1 hour buffer before and after
    const startBuffer = new Date(selectedDateTime.getTime() - (bufferHours * 60 * 60 * 1000));
    const endBuffer = new Date(selectedDateTime.getTime() + (bufferHours * 60 * 60 * 1000));
    
    // Check if this boat has any conflicting launches
    const hasConflict = allLaunches.some(launch => {
      if (launch.boatId !== boat.id) return false;
      if (launch.status === 'cancelled' || launch.status === 'retrieved') return false;
      
      const launchDateTime = new Date(launch.scheduledTime);
      return launchDateTime >= startBuffer && launchDateTime <= endBuffer;
    });
    
    return !hasConflict;
  }) : [];
  
  // Clear selected boat if it becomes unavailable when time changes
  const availableBoatIds = availableBoats.map(boat => boat.id).join(',');
  useEffect(() => {
    if (selectedBoat && launchTime && !isCreatingNewCustomer && availableBoats.length > 0) {
      const isSelectedBoatAvailable = availableBoats.some(boat => boat.id === selectedBoat);
      if (!isSelectedBoatAvailable) {
        setSelectedBoat("");
        toast({
          title: "Boat No Longer Available",
          description: "The selected boat is not available at this time. Please choose another boat.",
          variant: "default",
        });
      }
    }
  }, [launchTime, selectedBoat, availableBoatIds, isCreatingNewCustomer]);

  // Mutation for creating new customer
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData: any) => {
      const response = await apiRequest('POST', '/api/customers', customerData);
      return await response.json();
    },
  });

  // Mutation for creating new boat
  const createBoatMutation = useMutation({
    mutationFn: async (boatData: any) => {
      const response = await apiRequest('POST', '/api/boats', boatData);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate boat queries so UI reflects new boat immediately
      queryClient.invalidateQueries({ queryKey: ['/api/boats'] });
    },
    onError: (error: any) => {
      // Extract detailed error information from backend
      const errorMessage = error?.response?.data?.errors?.length > 0
        ? `Validation errors: ${error.response.data.errors.map((e: any) => e.message).join(', ')}`
        : error?.response?.data?.message || error?.message || "Failed to create boat";
      
      toast({
        title: "Error Creating Boat",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const scheduleLaunchMutation = useMutation({
    mutationFn: async (data: {
      marinaId: string;
      customerId: string;
      boatId: string;
      scheduledTime: string;
      notes?: string;
    }) => {
      const response = await apiRequest('POST', '/api/launches', data);
      return await response.json();
    },
    onSuccess: async (launch) => {
      try {
        // Invalidate queries to refresh the UI
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/launches'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/launches/upcoming'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/customers'] })
        ]);
        
        // Update customer stats
        try {
          await apiRequest('PUT', `/api/customers/${launch.customerId}`, {
            lastLaunchDate: launch.scheduledTime,
          });
        } catch (error) {
          console.warn('Failed to update customer stats:', error);
        }
        
        toast({
          title: "Launch Scheduled Successfully",
          description: "The boat launch has been scheduled and all parties will be notified.",
        });
        
        // Close modal after a brief delay to ensure success message is visible
        setTimeout(() => {
          handleClose();
        }, 500);
        
      } catch (error) {
        console.error('Error in onSuccess handler:', error);
        // Still close the modal even if some cleanup fails
        handleClose();
      }
    },
    onError: (error: any) => {
      // Handle server-side conflict responses
      if (error?.status === 409 || error?.response?.status === 409) {
        const serverMessage = error?.response?.data?.error || error?.data?.error || "This boat is already scheduled at this time.";
        toast({
          title: "Scheduling Conflict",
          description: serverMessage,
          variant: "destructive",
        });
        // Refresh launches data to update availability
        queryClient.invalidateQueries({ queryKey: ['/api/launches'] });
      } else {
        toast({
          title: "Error",
          description: "Failed to schedule launch. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleClose = useCallback(() => {
    // Reset all form state
    setSelectedCustomer("");
    setSelectedBoat("");
    setLaunchTime("");
    setNotes("");
    setIsCreatingNewCustomer(false);
    setIsAddingNewBoat(false);
    setCustomerSearchOpen(false);
    setNewCustomer({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      emergencyContact: { name: "", phone: "", relationship: "" }
    });
    setNewBoat({
      name: "",
      make: "",
      model: "",
      year: new Date().getFullYear(),
      length: "",
      beam: ""
    });
    
    // Use setTimeout to ensure state is reset before calling parent onClose
    setTimeout(() => {
      onClose();
    }, 0);
  }, [onClose]);

  // Check for launch conflicts at submit time
  const checkForConflicts = (boatId: string, scheduledTime: string): boolean => {
    if (!allLaunches.length) return false;
    
    const selectedDateTime = new Date(scheduledTime);
    const bufferHours = 1;
    const startBuffer = new Date(selectedDateTime.getTime() - (bufferHours * 60 * 60 * 1000));
    const endBuffer = new Date(selectedDateTime.getTime() + (bufferHours * 60 * 60 * 1000));
    
    return allLaunches.some(launch => {
      if (launch.boatId !== boatId) return false;
      if (launch.status === 'cancelled' || launch.status === 'retrieved') return false;
      
      const launchDateTime = new Date(launch.scheduledTime);
      return launchDateTime >= startBuffer && launchDateTime <= endBuffer;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (isCreatingNewCustomer) {
      // Enhanced validation for new customer form
      const requiredCustomerFields = {
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        email: newCustomer.email,
        phone: newCustomer.phone,
        address: newCustomer.address,
        emergencyContactName: newCustomer.emergencyContact.name,
        emergencyContactPhone: newCustomer.emergencyContact.phone,
        emergencyContactRelationship: newCustomer.emergencyContact.relationship
      };
      
      const requiredBoatFields = {
        name: newBoat.name,
        make: newBoat.make,
        model: newBoat.model,
        year: newBoat.year,
        length: newBoat.length,
        beam: newBoat.beam
      };
      
      // Check for missing customer fields
      const missingCustomerFields = Object.entries(requiredCustomerFields)
        .filter(([_, value]) => !value || (typeof value === 'string' && value.trim() === ''))
        .map(([key, _]) => key);
      
      // Check for missing boat fields
      const missingBoatFields = Object.entries(requiredBoatFields)
        .filter(([_, value]) => !value || (typeof value === 'string' && value.trim() === '') || (typeof value === 'number' && (!value || value <= 0)))
        .map(([key, _]) => key);
      
      if (!launchTime) {
        missingCustomerFields.push('launchTime');
      }
      
      if (missingCustomerFields.length > 0 || missingBoatFields.length > 0) {
        const allMissingFields = [...missingCustomerFields, ...missingBoatFields];
        toast({
          title: "Missing Required Information",
          description: `Please fill in all required fields: ${allMissingFields.join(', ')}.`,
          variant: "destructive",
        });
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newCustomer.email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        return;
      }
      
      // Create customer and boat, then schedule launch
      try {
        // Create customer first
        const createdCustomer = await createCustomerMutation.mutateAsync({
          firstName: newCustomer.firstName.trim(),
          lastName: newCustomer.lastName.trim(),
          email: newCustomer.email.trim().toLowerCase(),
          phone: newCustomer.phone.trim(),
          address: newCustomer.address.trim(),
          emergencyContact: {
            name: newCustomer.emergencyContact.name.trim(),
            phone: newCustomer.emergencyContact.phone.trim(),
            relationship: newCustomer.emergencyContact.relationship.trim()
          }
        });
        
        // Create boat for the new customer
        const createdBoat = await createBoatMutation.mutateAsync({
          customerId: createdCustomer.id,
          name: newBoat.name.trim(),
          make: newBoat.make.trim(),
          model: newBoat.model.trim(),
          year: parseInt(newBoat.year.toString()) || new Date().getFullYear(),
          length: String(parseFloat(newBoat.length.toString())),
          beam: String(parseFloat(newBoat.beam.toString()))
        });
        
        // Now schedule the launch
        scheduleLaunchMutation.mutate({
          marinaId: "c3f6031b-e476-48bd-9a38-dedd71d7409d", // Main Marina ID
          customerId: createdCustomer.id,
          boatId: createdBoat.id,
          scheduledTime: new Date(launchTime).toISOString(),
          notes: notes || undefined,
        });
        
        return;
        
      } catch (error: any) {
        toast({
          title: "Error Creating Customer/Boat",
          description: error?.message || "Failed to create customer and boat. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }
    
    // Handle adding new boat for existing customer
    if (isAddingNewBoat && selectedCustomer && !isCreatingNewCustomer) {
      // Enhanced validation for new boat form
      const requiredBoatFields = {
        name: newBoat.name,
        make: newBoat.make,
        model: newBoat.model,
        year: newBoat.year,
        length: newBoat.length,
        beam: newBoat.beam
      };
      
      // Check for missing boat fields and validate numeric values
      const missingBoatFields: string[] = [];
      Object.entries(requiredBoatFields).forEach(([key, value]) => {
        if (!value || (typeof value === 'string' && value.trim() === '') || (typeof value === 'number' && (!value || value <= 0))) {
          missingBoatFields.push(key);
        }
        // Validate length and beam are positive numbers
        if ((key === 'length' || key === 'beam') && value) {
          const numValue = parseFloat(value.toString());
          if (isNaN(numValue) || numValue <= 0 || numValue > 999.99) {
            missingBoatFields.push(key + ' (must be a positive number ≤ 999.99)');
          }
        }
      });
      
      if (!launchTime) {
        missingBoatFields.push('launchTime');
      }
      
      if (missingBoatFields.length > 0) {
        toast({
          title: "Missing Required Information",
          description: `Please fill in all required boat fields: ${missingBoatFields.join(', ')}.`,
          variant: "destructive",
        });
        return;
      }
      
      // Validate launch time is not in the past
      const selectedDateTime = new Date(launchTime);
      const now = new Date();
      if (selectedDateTime <= now) {
        toast({
          title: "Invalid Launch Time",
          description: "Launch time must be in the future.",
          variant: "destructive",
        });
        return;
      }
      
      // Create boat for the existing customer, then schedule launch
      try {
        // Create boat for the existing customer
        const createdBoat = await createBoatMutation.mutateAsync({
          customerId: selectedCustomer,
          name: newBoat.name.trim(),
          make: newBoat.make.trim(),
          model: newBoat.model.trim(),
          year: parseInt(newBoat.year.toString()) || new Date().getFullYear(),
          length: String(parseFloat(newBoat.length.toString())),
          beam: String(parseFloat(newBoat.beam.toString()))
        });
        
        // Now schedule the launch with the new boat
        scheduleLaunchMutation.mutate({
          marinaId: "c3f6031b-e476-48bd-9a38-dedd71d7409d", // Main Marina ID
          customerId: selectedCustomer,
          boatId: createdBoat.id,
          scheduledTime: new Date(launchTime).toISOString(),
          notes: notes || undefined,
        });
        
        return;
        
      } catch (error: any) {
        // Error handling is now in createBoatMutation.onError
        return;
      }
    }
    
    // Enhanced validation for existing customer flow
    const missingFields = [];
    if (!selectedCustomer) missingFields.push('Customer');
    if (!selectedBoat && !isAddingNewBoat) missingFields.push('Boat');
    if (!launchTime) missingFields.push('Launch Time');
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Information",
        description: `Please select: ${missingFields.join(', ')}.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validate launch time is not in the past
    const selectedDateTime = new Date(launchTime);
    const now = new Date();
    if (selectedDateTime <= now) {
      toast({
        title: "Invalid Launch Time",
        description: "Launch time must be in the future.",
        variant: "destructive",
      });
      return;
    }

    // Submit-time conflict check - ensure launches data is loaded
    if (launchesLoading || launchesFetching) {
      toast({
        title: "Loading",
        description: "Please wait while we check for scheduling conflicts.",
        variant: "default",
      });
      return;
    }
    
    if (checkForConflicts(selectedBoat, launchTime)) {
      toast({
        title: "Scheduling Conflict",
        description: "This boat is already scheduled for launch at this time. Please select a different time or boat.",
        variant: "destructive",
      });
      return;
    }

    scheduleLaunchMutation.mutate({
      marinaId: "c3f6031b-e476-48bd-9a38-dedd71d7409d", // Main Marina ID
      customerId: selectedCustomer,
      boatId: selectedBoat,
      scheduledTime: new Date(launchTime).toISOString(),
      notes: notes || undefined,
    });
  };

  // Set default launch time to current time + 1 hour
  const getDefaultLaunchTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  };

  // Effect to handle modal opening/closing states
  useEffect(() => {
    if (!isOpen) {
      // Reset any popover state when modal closes
      setCustomerSearchOpen(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleClose();
      }
    }}>
      <DialogContent 
        className={cn("sm:max-w-2xl max-h-[90vh] overflow-y-auto", isCreatingNewCustomer && "sm:max-w-4xl")} 
        data-testid="launch-modal"
        onPointerDownOutside={(e) => {
          // Allow clicking outside to close the modal
          e.preventDefault();
          handleClose();
        }}
        onEscapeKeyDown={(e) => {
          // Allow escape key to close the modal
          e.preventDefault();
          handleClose();
        }}
      >
        <DialogHeader>
          <DialogTitle data-testid="modal-title">Schedule New Launch</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer">Customer *</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between"
                  data-testid="select-customer"
                >
                  {selectedCustomer ? (
                    isCreatingNewCustomer ? (
                      "New Customer"
                    ) : (
                      customers.find((customer) => customer.id === selectedCustomer)
                        ? `${customers.find((customer) => customer.id === selectedCustomer)?.firstName} ${customers.find((customer) => customer.id === selectedCustomer)?.lastName}`
                        : "Select customer..."
                    )
                  ) : (
                    "Search customers or create new..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" data-testid="customer-popover">
                <Command>
                  <CommandInput placeholder="Search customers..." />
                  <CommandList>
                    <CommandEmpty>No customers found.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        key="new-customer"
                        value="new-customer"
                        onSelect={() => {
                          setIsCreatingNewCustomer(true);
                          setSelectedCustomer("new-customer");
                          setCustomerSearchOpen(false);
                        }}
                        data-testid="create-new-customer"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Customer
                      </CommandItem>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={`${customer.firstName} ${customer.lastName}`}
                          onSelect={() => {
                            setSelectedCustomer(customer.id);
                            setIsCreatingNewCustomer(false);
                            setCustomerSearchOpen(false);
                          }}
                          data-testid={`customer-option-${customer.id}`}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedCustomer === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {customer.firstName} {customer.lastName}
                          {customer.email && (
                            <span className="ml-auto text-xs text-muted-foreground">
                              {customer.email}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* New Customer Form Fields */}
          {isCreatingNewCustomer && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newCustomer.firstName}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="John"
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={newCustomer.lastName}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Smith"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john.smith@example.com"
                  data-testid="input-email"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Marina Dr"
                    data-testid="input-address"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Emergency Contact</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={newCustomer.emergencyContact.name}
                    onChange={(e) => setNewCustomer(prev => ({ 
                      ...prev, 
                      emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                    }))}
                    placeholder="Contact Name"
                    data-testid="input-emergency-name"
                  />
                  <Input
                    value={newCustomer.emergencyContact.phone}
                    onChange={(e) => setNewCustomer(prev => ({ 
                      ...prev, 
                      emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                    }))}
                    placeholder="Phone"
                    data-testid="input-emergency-phone"
                  />
                  <Input
                    value={newCustomer.emergencyContact.relationship}
                    onChange={(e) => setNewCustomer(prev => ({ 
                      ...prev, 
                      emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                    }))}
                    placeholder="Relationship"
                    data-testid="input-emergency-relationship"
                  />
                </div>
              </div>

              {/* New Boat Form Fields */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Boat Information</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="boatName">Boat Name *</Label>
                    <Input
                      id="boatName"
                      value={newBoat.name}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Sea Explorer"
                      data-testid="input-boat-name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="boatYear">Year *</Label>
                      <Input
                        id="boatYear"
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        value={newBoat.year}
                        onChange={(e) => setNewBoat(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                        data-testid="input-boat-year"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="boatMake">Make *</Label>
                      <Input
                        id="boatMake"
                        value={newBoat.make}
                        onChange={(e) => setNewBoat(prev => ({ ...prev, make: e.target.value }))}
                        placeholder="Boston Whaler"
                        data-testid="input-boat-make"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="boatModel">Model *</Label>
                      <Input
                        id="boatModel"
                        value={newBoat.model}
                        onChange={(e) => setNewBoat(prev => ({ ...prev, model: e.target.value }))}
                        placeholder="Outrage"
                        data-testid="input-boat-model"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="boatLength">Length (ft) *</Label>
                      <Input
                        id="boatLength"
                        type="number"
                        step="0.1"
                        min="1"
                        value={newBoat.length}
                        onChange={(e) => setNewBoat(prev => ({ ...prev, length: e.target.value }))}
                        placeholder="28.5"
                        data-testid="input-boat-length"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="boatBeam">Beam (ft) *</Label>
                      <Input
                        id="boatBeam"
                        type="number"
                        step="0.1"
                        min="1"
                        value={newBoat.beam}
                        onChange={(e) => setNewBoat(prev => ({ ...prev, beam: e.target.value }))}
                        placeholder="9.5"
                        data-testid="input-boat-beam"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="launchTime">Launch Time *</Label>
            <Input
              id="launchTime"
              type="datetime-local"
              value={launchTime}
              onChange={(e) => setLaunchTime(e.target.value)}
              min={getDefaultLaunchTime()}
              data-testid="input-launch-time"
            />
          </div>

          {selectedCustomer && !isCreatingNewCustomer && (
            <div className="space-y-2">
              <Label htmlFor="boat">Boat *</Label>
              <Select 
                value={isAddingNewBoat ? "add-new-boat" : selectedBoat} 
                onValueChange={(value) => {
                  if (value === "add-new-boat") {
                    setIsAddingNewBoat(true);
                    setSelectedBoat("");
                  } else {
                    setIsAddingNewBoat(false);
                    setSelectedBoat(value);
                  }
                }}
              >
                <SelectTrigger data-testid="select-boat">
                  <SelectValue placeholder="Select boat..." />
                </SelectTrigger>
                <SelectContent data-testid="boat-select-content">
                  {!launchTime ? (
                    <div className="p-2 text-sm text-muted-foreground" data-testid="boat-select-time-prompt">
                      Select a launch time first to see available boats.
                    </div>
                  ) : (
                    <>
                      <SelectItem key="add-new-boat" value="add-new-boat" data-testid="add-new-boat-option">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Boat
                      </SelectItem>
                      {availableBoats.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground" data-testid="boat-select-no-boats">
                          No existing boats available at this time. You can add a new boat above.
                        </div>
                      ) : (
                        availableBoats.map((boat) => (
                          <SelectItem key={boat.id} value={boat.id} data-testid={`boat-option-${boat.id}`}>
                            {boat.name || `${boat.year} ${boat.make} ${boat.model}`}
                            {customerBoats.length > availableBoats.length && (
                              <span className="ml-2 text-xs text-green-600">✓ Available</span>
                            )}
                          </SelectItem>
                        ))
                      )}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* New Boat Form Fields for Existing Customer */}
          {isAddingNewBoat && selectedCustomer && !isCreatingNewCustomer && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">New Boat Information</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="existingCustomerBoatName">Boat Name *</Label>
                  <Input
                    id="existingCustomerBoatName"
                    value={newBoat.name}
                    onChange={(e) => setNewBoat(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Sea Explorer"
                    data-testid="input-existing-customer-boat-name"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="existingCustomerBoatYear">Year *</Label>
                    <Input
                      id="existingCustomerBoatYear"
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={newBoat.year}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                      data-testid="input-existing-customer-boat-year"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingCustomerBoatMake">Make *</Label>
                    <Input
                      id="existingCustomerBoatMake"
                      value={newBoat.make}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, make: e.target.value }))}
                      placeholder="Boston Whaler"
                      data-testid="input-existing-customer-boat-make"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingCustomerBoatModel">Model *</Label>
                    <Input
                      id="existingCustomerBoatModel"
                      value={newBoat.model}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, model: e.target.value }))}
                      placeholder="Outrage"
                      data-testid="input-existing-customer-boat-model"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="existingCustomerBoatLength">Length (ft) *</Label>
                    <Input
                      id="existingCustomerBoatLength"
                      type="number"
                      step="0.1"
                      min="1"
                      value={newBoat.length}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, length: e.target.value }))}
                      placeholder="28.5"
                      data-testid="input-existing-customer-boat-length"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existingCustomerBoatBeam">Beam (ft) *</Label>
                    <Input
                      id="existingCustomerBoatBeam"
                      type="number"
                      step="0.1"
                      min="1"
                      value={newBoat.beam}
                      onChange={(e) => setNewBoat(prev => ({ ...prev, beam: e.target.value }))}
                      placeholder="9.5"
                      data-testid="input-existing-customer-boat-beam"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions..."
              rows={3}
              data-testid="textarea-notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={scheduleLaunchMutation.isPending}
              data-testid="button-schedule"
            >
              {scheduleLaunchMutation.isPending ? "Scheduling..." : 
               isCreatingNewCustomer ? "Create Customer & Schedule Launch" :
               isAddingNewBoat ? "Add Boat & Schedule Launch" : "Schedule Launch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
