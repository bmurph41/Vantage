import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Clock, DollarSign, Users, AlertCircle, Save, CheckCircle, XCircle, Calendar, Play, Circle, MinusCircle, MapPin, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatPhoneNumber } from "@/lib/phone-utils";
import { toStateAbbr } from "@/lib/state-utils";
import { format, parseISO } from "date-fns";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useProject } from "@/hooks/use-project";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { marinaDueDiligenceTaskTemplates, taskCategories, searchTasks, type TaskTemplate } from "@/data/marina-due-diligence-tasks";
import { DocumentRequirementsManagement } from "./document-requirements-management";
import { TaskCompletionGate } from "./task-completion-gate";
import { TaskFiles } from "./task-files";
import { AddressInput, type AddressComponents } from "@/components/address-input";
import type { Task } from "@shared/schema";

// Task Owner Selector Component
function TaskOwnerSelector({ projectId, value, onChange }: { 
  projectId: string; 
  value: string; 
  onChange: (value: string) => void; 
}) {
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  // Fetch contacts on deal team
  const { data: contacts = [] } = useQuery<Array<{ id: string; name: string; onDealTeam: boolean }>>({
    queryKey: ['/api/dd/contacts'],
  });

  // Filter for deal team members
  const dealTeamMembers = contacts.filter(c => c.onDealTeam).map(c => c.name);

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "manual_entry") {
      setShowInput(true);
      setInputValue(value);
    } else {
      setShowInput(false);
      onChange(selectedValue);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowInput(false);
      setInputValue(value);
    }
  };

  if (showInput) {
    return (
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={() => setShowInput(false)}
          placeholder="Enter team member name"
          autoFocus
          data-testid="input-assignee-manual"
        />
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          className="absolute right-1 top-1 h-6 w-6 p-0"
          onClick={() => setShowInput(false)}
        >
          ×
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={handleSelectChange}>
      <SelectTrigger data-testid="select-task-owner">
        <SelectValue placeholder="Select or enter team member" />
      </SelectTrigger>
      <SelectContent>
        {dealTeamMembers.length > 0 && (
          <>
            {dealTeamMembers.map((member: string) => (
              <SelectItem key={member} value={member}>
                {member}
              </SelectItem>
            ))}
            <SelectItem value="manual_entry">
              <div className="flex items-center gap-2 text-blue-600">
                <Users className="h-4 w-4" />
                <span>Enter new name...</span>
              </div>
            </SelectItem>
          </>
        )}
        {dealTeamMembers.length === 0 && (
          <SelectItem value="manual_entry">
            <div className="flex items-center gap-2 text-blue-600">
              <Users className="h-4 w-4" />
              <span>Enter team member name...</span>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// Task Dependencies Selector Component — supports DD Tasks, DD Request Items, and Custom deps
function TaskDependenciesSelector({ 
  projectId, 
  value, 
  onChange, 
  currentTaskId 
}: { 
  projectId: string; 
  value: string[]; 
  onChange: (value: string[]) => void; 
  currentTaskId?: string; 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [depTab, setDepTab] = useState<"tasks" | "dd_requests" | "custom">("tasks");
  const [searchFilter, setSearchFilter] = useState("");
  const [customDeps, setCustomDeps] = useState<{name: string; priority: string; deadline: string; contact: string}[]>([]);
  const [newCustom, setNewCustom] = useState({ name: "", priority: "med", deadline: "", contact: "" });

  const safeValue = value || [];

  const { data: projectData } = useProject(projectId);
  const availableTasks = projectData?.tasks || [];
  const selectableTasks = availableTasks.filter((task: any) => task.id !== currentTaskId);

  const { data: ddRequestItems = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'dd-request-items'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/dd-request-items`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const handleToggle = (id: string) => {
    const next = safeValue.includes(id) ? safeValue.filter(x => x !== id) : [...safeValue, id];
    onChange(next);
  };

  const handleAddCustomDep = () => {
    if (!newCustom.name.trim()) return;
    const customId = `custom_${Date.now()}`;
    setCustomDeps(prev => [...prev, { ...newCustom }]);
    onChange([...safeValue, customId]);
    setNewCustom({ name: "", priority: "med", deadline: "", contact: "" });
  };

  const handleRemoveCustomDep = (index: number) => {
    setCustomDeps(prev => prev.filter((_, i) => i !== index));
    const customIds = safeValue.filter(v => v.startsWith('custom_'));
    if (customIds[index]) {
      onChange(safeValue.filter(v => v !== customIds[index]));
    }
  };

  const getSelectedItems = () => {
    const items: { id: string; label: string; type: string }[] = [];
    safeValue.forEach(id => {
      if (id.startsWith('custom_')) return;
      const task = selectableTasks.find((t: any) => t.id === id);
      if (task) { items.push({ id, label: task.title, type: 'task' }); return; }
      const ddItem = ddRequestItems.find((d: any) => d.id === id);
      if (ddItem) { items.push({ id, label: `${ddItem.sectionTitle}: ${ddItem.title}`, type: 'dd_request' }); return; }
      items.push({ id, label: id, type: 'unknown' });
    });
    return items;
  };

  const selectedItems = getSelectedItems();
  const totalSelected = selectedItems.length + customDeps.length;

  // Filter lists
  const filteredTasks = selectableTasks.filter((t: any) =>
    !searchFilter || t.title?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  const filteredDdItems = ddRequestItems.filter((d: any) =>
    !searchFilter || d.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.sectionTitle?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.subCategory?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Group DD items by section
  const ddItemsBySection: Record<string, any[]> = {};
  filteredDdItems.forEach((item: any) => {
    const section = item.sectionTitle || 'Other';
    if (!ddItemsBySection[section]) ddItemsBySection[section] = [];
    ddItemsBySection[section].push(item);
  });

  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-700", med: "bg-amber-100 text-amber-700", low: "bg-gray-100 text-gray-500"
  };
  const ddPriorityColors: Record<number, string> = {
    1: "bg-red-100 text-red-700", 2: "bg-amber-100 text-amber-700", 3: "bg-gray-100 text-gray-500"
  };
  const statusBadge = (status: string) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'provided') return 'bg-amber-100 text-amber-700';
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-2">
      {/* Selected Dependencies Summary */}
      <Button
        type="button" variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between h-auto min-h-10 p-3"
      >
        <div className="flex flex-wrap gap-1">
          {totalSelected === 0 ? (
            <span className="text-muted-foreground text-sm">Select dependencies...</span>
          ) : (
            <>
              {selectedItems.map((item) => (
                <Badge key={item.id} variant={item.type === 'dd_request' ? 'default' : 'secondary'} className="text-xs">
                  {item.type === 'dd_request' && <span className="mr-1">📋</span>}
                  {item.label}
                </Badge>
              ))}
              {customDeps.map((dep, i) => (
                <Badge key={`custom-${i}`} variant="outline" className="text-xs border-dashed">
                  ✏️ {dep.name}
                </Badge>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          {totalSelected > 0 && (
            <Button type="button" variant="ghost" size="sm"
              className="h-5 w-5 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => { e.stopPropagation(); onChange([]); setCustomDeps([]); }}>
              <XCircle className="h-3 w-3" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{totalSelected}</span>
        </div>
      </Button>

      {/* Expanded Selector */}
      {isOpen && (
        <Card className="border">
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="flex border-b">
              {[
                { key: "tasks", label: `DD Tasks (${selectableTasks.length})` },
                { key: "dd_requests", label: `DD Requests (${ddRequestItems.length})` },
                { key: "custom", label: `Custom (${customDeps.length})` },
              ].map(tab => (
                <button key={tab.key} type="button"
                  className={`flex-1 text-xs font-medium py-2 px-3 border-b-2 transition-colors ${
                    depTab === tab.key ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setDepTab(tab.key as any)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            {depTab !== "custom" && (
              <div className="p-2 border-b">
                <Input placeholder="Filter..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
                  className="h-7 text-xs" />
              </div>
            )}

            {/* DD Tasks Tab */}
            {depTab === "tasks" && (
              <ScrollArea className="max-h-52">
                <div className="p-2 space-y-1">
                  {filteredTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {selectableTasks.length === 0 ? 'No DD tasks created yet.' : 'No matches.'}
                    </p>
                  )}
                  {filteredTasks.map((task: any) => (
                    <div key={task.id}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        safeValue.includes(task.id) ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-muted'
                      }`}
                      onClick={() => handleToggle(task.id)}>
                      <Checkbox checked={safeValue.includes(task.id)} className="pointer-events-none" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{task.title}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0 rounded ${priorityColors[task.priority] || priorityColors.med}`}>
                            {task.priority}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0 rounded ${statusBadge(task.status)}`}>
                            {(task.status || '').replace('_', ' ')}
                          </span>
                          {task.assignee && <span className="text-[10px] text-muted-foreground">{task.assignee}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* DD Request Items Tab */}
            {depTab === "dd_requests" && (
              <ScrollArea className="max-h-52">
                <div className="p-2 space-y-2">
                  {Object.keys(ddItemsBySection).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {ddRequestItems.length === 0 ? 'No DD Request checklist found. Create one in the DD Request tab.' : 'No matches.'}
                    </p>
                  )}
                  {Object.entries(ddItemsBySection).map(([sectionTitle, items]) => (
                    <div key={sectionTitle}>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                        {sectionTitle}
                      </div>
                      {items.map((item: any) => (
                        <div key={item.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            safeValue.includes(item.id) ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-muted'
                          }`}
                          onClick={() => handleToggle(item.id)}>
                          <Checkbox checked={safeValue.includes(item.id)} className="pointer-events-none" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0 rounded ${ddPriorityColors[item.priority] || ddPriorityColors[2]}`}>
                                {item.priority === 1 ? 'High' : item.priority === 2 ? 'Med' : 'Low'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0 rounded ${statusBadge(item.status)}`}>
                                {(item.status || 'open').replace('_', ' ')}
                              </span>
                              {item.subCategory && <span className="text-[10px] text-muted-foreground">{item.subCategory}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Custom Dependencies Tab */}
            {depTab === "custom" && (
              <div className="p-3 space-y-3">
                {customDeps.length > 0 && (
                  <div className="space-y-1.5">
                    {customDeps.map((dep, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{dep.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className={`px-1.5 py-0 rounded ${priorityColors[dep.priority] || priorityColors.med}`}>
                              {dep.priority}
                            </span>
                            {dep.deadline && <span>Due: {dep.deadline}</span>}
                            {dep.contact && <span>Contact: {dep.contact}</span>}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                          onClick={() => handleRemoveCustomDep(i)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-2 pt-1 border-t">
                  <div className="text-xs font-medium text-muted-foreground">Add Custom Dependency</div>
                  <Input placeholder="Dependency name *" value={newCustom.name}
                    onChange={e => setNewCustom(prev => ({ ...prev, name: e.target.value }))}
                    className="h-8 text-sm" />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={newCustom.priority}
                      onChange={e => setNewCustom(prev => ({ ...prev, priority: e.target.value }))}
                      className="h-8 text-xs rounded-md border px-2 bg-background">
                      <option value="high">High</option>
                      <option value="med">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <Input type="date" value={newCustom.deadline}
                      onChange={e => setNewCustom(prev => ({ ...prev, deadline: e.target.value }))}
                      className="h-8 text-xs" />
                    <Input placeholder="Contact" value={newCustom.contact}
                      onChange={e => setNewCustom(prev => ({ ...prev, contact: e.target.value }))}
                      className="h-8 text-xs" />
                  </div>
                  <Button type="button" size="sm" className="h-7 text-xs w-full"
                    onClick={handleAddCustomDep} disabled={!newCustom.name.trim()}>
                    + Add Dependency
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// Company Selector Component
function CompanySelector({ value, onChange, onCompanySelect, manualValue }: { 
  value: string; 
  onChange: (value: string) => void;
  onCompanySelect?: (company: any) => void;
  manualValue?: string;
}) {
  // Show manual input if there's manual text but no CRM ID
  const showManual = !value && !!manualValue;
  const [localShowInput, setLocalShowInput] = useState(false);
  
  // Determine whether to show input (either from prop or local state)
  const showInput = showManual || localShowInput;

  // Fetch CRM companies
  const { data: companies = [] } = useQuery<Array<{ id: string; name: string; address: string; phone: string }>>({
    queryKey: ['/api/crm/companies'],
  });

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "manual_entry") {
      setLocalShowInput(true);
      // Clear CRM ID when switching to manual entry
      onChange("");
      // Clear auto-populated CRM fields to prevent stale data
      if (onCompanySelect) {
        onCompanySelect({ name: "", address: "", phone: "" });
      }
    } else {
      setLocalShowInput(false);
      // Set CRM ID
      onChange(selectedValue);
      const selectedCompany = companies.find(c => c.id === selectedValue);
      if (selectedCompany && onCompanySelect) {
        onCompanySelect(selectedCompany);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Update text field directly via callback
    if (onCompanySelect) {
      onCompanySelect({ name: newValue, address: "", phone: "" });
    }
  };

  const handleClose = () => {
    setLocalShowInput(false);
    // If there's no manual value, show selector again
  };

  if (showInput) {
    return (
      <div className="relative">
        <Input
          value={manualValue || ""}
          onChange={handleInputChange}
          placeholder="Enter company name"
          autoFocus
          data-testid="input-company-manual"
        />
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          className="absolute right-1 top-1 h-6 w-6 p-0"
          onClick={handleClose}
        >
          ×
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={handleSelectChange}>
      <SelectTrigger data-testid="select-company">
        <SelectValue placeholder="Select from CRM or enter manually" />
      </SelectTrigger>
      <SelectContent>
        {companies.length > 0 && (
          <>
            {companies.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
            <SelectItem value="manual_entry">
              <div className="flex items-center gap-2 text-blue-600">
                <Users className="h-4 w-4" />
                <span>Enter manually...</span>
              </div>
            </SelectItem>
          </>
        )}
        {companies.length === 0 && (
          <SelectItem value="manual_entry">
            <div className="flex items-center gap-2 text-blue-600">
              <Users className="h-4 w-4" />
              <span>Enter company name...</span>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

// Contact Selector Component
function ContactSelector({ companyId, value, onChange, onContactSelect, manualValue }: { 
  companyId?: string;
  value: string; 
  onChange: (value: string) => void;
  onContactSelect?: (contact: any) => void;
  manualValue?: string;
}) {
  // Show manual input if there's manual text but no CRM ID
  const showManual = !value && !!manualValue;
  const [localShowInput, setLocalShowInput] = useState(false);
  
  // Determine whether to show input (either from prop or local state)
  const showInput = showManual || localShowInput;

  // Fetch CRM contacts
  const { data: allContacts = [] } = useQuery<Array<{ 
    id: string; 
    firstName: string; 
    lastName: string; 
    email: string; 
    phone: string;
    phones: Array<{type: string; number: string}>;
    companyId: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  }>>({
    queryKey: ['/api/crm/contacts'],
  });

  // Filter contacts by company if companyId is provided
  const contacts = companyId 
    ? allContacts.filter(c => c.companyId === companyId)
    : allContacts;

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "manual_entry") {
      setLocalShowInput(true);
      // Clear CRM ID when switching to manual entry
      onChange("");
      // Clear auto-populated CRM fields to prevent stale data
      if (onContactSelect) {
        onContactSelect({ 
          firstName: '', 
          lastName: '',
          email: '', 
          phone: '', 
          phones: [],
          address: '', 
          city: '', 
          state: '', 
          zipCode: '' 
        });
      }
    } else {
      setLocalShowInput(false);
      // Set CRM ID
      onChange(selectedValue);
      const selectedContact = allContacts.find(c => c.id === selectedValue);
      if (selectedContact && onContactSelect) {
        onContactSelect(selectedContact);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Update text field directly via callback
    if (onContactSelect) {
      onContactSelect({ 
        firstName: newValue.split(' ')[0] || '', 
        lastName: newValue.split(' ').slice(1).join(' ') || '',
        email: '', 
        phone: '', 
        phones: [],
        address: '', 
        city: '', 
        state: '', 
        zipCode: '' 
      });
    }
  };

  const handleClose = () => {
    setLocalShowInput(false);
  };

  if (showInput) {
    return (
      <div className="relative">
        <Input
          value={manualValue || ""}
          onChange={handleInputChange}
          placeholder="Enter contact name"
          autoFocus
          data-testid="input-contact-manual"
        />
        <Button 
          type="button"
          variant="ghost" 
          size="sm" 
          className="absolute right-1 top-1 h-6 w-6 p-0"
          onClick={handleClose}
        >
          ×
        </Button>
      </div>
    );
  }

  return (
    <Select value={value || ""} onValueChange={handleSelectChange}>
      <SelectTrigger data-testid="select-contact">
        <SelectValue placeholder={companyId ? "Select rep from company" : "Select from CRM or enter manually"} />
      </SelectTrigger>
      <SelectContent>
        {contacts.length > 0 && (
          <>
            {contacts.map((contact) => (
              <SelectItem key={contact.id} value={contact.id}>
                {contact.firstName} {contact.lastName}
              </SelectItem>
            ))}
            <SelectItem value="manual_entry">
              <div className="flex items-center gap-2 text-blue-600">
                <Users className="h-4 w-4" />
                <span>Enter manually...</span>
              </div>
            </SelectItem>
          </>
        )}
        {contacts.length === 0 && (
          <SelectItem value="manual_entry">
            <div className="flex items-center gap-2 text-blue-600">
              <Users className="h-4 w-4" />
              <span>Enter contact name...</span>
            </div>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}

const addTaskFormSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  startStrategy: z.enum(["fixed", "offset"]).default("offset"),
  startDate: z.string().optional(),
  startOffsetDays: z.number().optional(),
  // New deadline fields
  deadlineType: z.enum(["dd_expiration", "days_after_psa"]).optional(),
  deadlineDays: z.number().optional(),
  deadline: z.string().optional(),
  assignee: z.string().optional(),
  // CRM Integration
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  // Legacy text fields
  companyHired: z.string().optional(),
  repName: z.string().optional(),
  repEmail: z.string().optional(),
  repPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  companySuite: z.string().optional(),
  companyCity: z.string().optional(),
  companyState: z.string().optional(),
  companyZip: z.string().optional(),
  priority: z.enum(["low", "med", "high"]).default("med"),
  status: z.enum(["not_started", "engaged", "scheduled", "in_progress", "completed"]).default("not_started"),
  dateEngaged: z.string().optional(),
  paymentStatus: z.enum(["not_paid", "paid", "no_cost"]).default("not_paid"),
  dateOnSite: z.string().optional(),
  requiresOnSiteInspection: z.boolean().default(false),
  completedAt: z.string().optional(),
  cost: z.string().optional(),
  notes: z.string().optional(),
  showOnTimeline: z.boolean().default(false),
  isInternalTask: z.boolean().default(false),
  requiresDecision: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
});

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  editingTask?: Task | null | undefined;
}

export function AddTaskModal({ isOpen, onClose, projectId, editingTask }: AddTaskModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  
  // Fetch project data to access DD expiration date
  const { data: projectData } = useProject(projectId);
  const project = projectData?.project;
  const [step, setStep] = useState<"browse" | "customize">("browse");
  
  const { toast } = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  
  const isEditMode = !!editingTask;

  // Use built-in templates only (database template functionality removed due to type incompatibility)
  const allTemplates = marinaDueDiligenceTaskTemplates.map(t => ({...t, defaultAssignee: t.defaultAssignee || undefined}));

  // Use built-in categories only
  const allCategories = taskCategories;

  // Currency formatting utility
  const formatCurrency = (value: string): string => {
    if (!value) return "";
    
    // Remove any non-numeric characters except decimal points
    const numericValue = value.replace(/[^\d.]/g, "");
    
    // If empty or just a decimal point, return as is
    if (!numericValue || numericValue === ".") return numericValue;
    
    // Parse as number and format with commas and dollar sign
    const number = parseFloat(numericValue);
    if (isNaN(number)) return numericValue;
    
    // Format with dollar sign and commas, no decimal places for whole numbers
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: number % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    }).format(number);
  };

  // Handle cost field formatting
  const handleCostBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    form.setValue("cost", formatted);
  };

  const form = useForm<z.infer<typeof addTaskFormSchema>>({
    resolver: zodResolver(addTaskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startStrategy: "offset",
      startDate: "",
      startOffsetDays: 0,

      deadlineType: "dd_expiration",

      assignee: "",
      companyId: "",
      contactId: "",
      companyHired: "",
      repName: "",
      repEmail: "",
      repPhone: "",
      companySuite: "",
      priority: "med",
      status: "not_started",
      dateEngaged: "",
      paymentStatus: "not_paid",
      dateOnSite: "",
      requiresOnSiteInspection: false,
      completedAt: "",
      cost: "",
      notes: "",
      showOnTimeline: false,
      isInternalTask: false,
      requiresDecision: false,
      dependencies: [],
    },
  });

  // Reset form when editingTask changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        // Populate form with editing task data
        form.reset({
          title: editingTask.title || "",
          description: editingTask.description || "",
          startStrategy: editingTask.startStrategy || "offset",
          startDate: editingTask.startDate || "",
          startOffsetDays: editingTask.startOffsetDays || 0,
          deadlineType: editingTask.deadlineType || "dd_expiration",
          deadline: editingTask.deadline || "",
          assignee: editingTask.assignee || "",
          companyId: (editingTask as any).companyId || "",
          contactId: (editingTask as any).contactId || "",
          companyHired: editingTask.companyHired || "",
          repName: editingTask.repName || "",
          repEmail: editingTask.repEmail || "",
          repPhone: editingTask.repPhone || "",
          companyAddress: editingTask.companyAddress || "",
          companySuite: editingTask.companySuite || "",
          companyCity: editingTask.companyCity || "",
          companyState: editingTask.companyState || "",
          companyZip: editingTask.companyZip || "",
          priority: editingTask.priority || "med",
          status: editingTask.status || "not_started",
          dateEngaged: editingTask.dateEngaged || "",
          paymentStatus: editingTask.paymentStatus || "not_paid",
          dateOnSite: editingTask.dateOnSite || "",
          requiresOnSiteInspection: !!editingTask.dateOnSite,
          completedAt: editingTask.completedAt ? new Date(editingTask.completedAt).toISOString().slice(0, 16) : "",
          cost: editingTask.cost || "",
          notes: editingTask.notes || "",
          showOnTimeline: editingTask.showOnTimeline || false,
          isInternalTask: !editingTask.companyHired, // Infer from whether company is set
          dependencies: editingTask.dependencies || [],
        });
        setStep("customize"); // Go directly to customize step for editing
      } else {
        // Reset form for new task
        form.reset({
          title: "",
          description: "",
          startStrategy: "offset",
          startDate: "",
          startOffsetDays: 0,
    
          deadlineType: "dd_expiration",
          deadline: "",
          assignee: "",
          companyHired: "",
          repName: "",
          repEmail: "",
          repPhone: "",
          companyAddress: "",
          companyCity: "",
          companyState: "",
          companyZip: "",
          priority: "med",
          status: "not_started",
          paymentStatus: "not_paid",
          dateOnSite: "",
          completedAt: "",
          cost: "",
          notes: "",
          showOnTimeline: false,
          dependencies: [],
        });
        setStep("browse"); // Start with browse step for new tasks
      }
    }
  }, [isOpen, editingTask]);



  // Filter tasks based on search and category
  const filteredTasks = allTemplates.filter(task => {
    const matchesSearch = searchTerm === "" || 
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.category && task.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    
    // Populate form with template data
    form.reset({
      title: template.name,
      description: template.description,
      startStrategy: "offset",
      startOffsetDays: template.startOffsetDays,
      deadlineType: "dd_expiration" as const,
      assignee: template.defaultAssignee || "",
      companyId: "",
      contactId: "",
      companyHired: "",
      repName: "",
      repEmail: "",
      repPhone: "",
      companyAddress: "",
      companyCity: "",
      companyState: "",
      companyZip: "",
      priority: template.priority as "low" | "med" | "high",
      cost: template.estimatedCost || "",
      notes: "",
      showOnTimeline: false,
      isInternalTask: false,
      dependencies: [],
    });
    
    setStep("customize");
  };

  const handleCreateCustomTask = () => {
    setSelectedTemplate(null);
    
    // Reset form with blank data for custom task
    form.reset({
      title: "",
      description: "",
      startStrategy: "offset",
      startDate: "",
      startOffsetDays: 0,
      deadlineType: "dd_expiration",
      assignee: "",
      companyId: "",
      contactId: "",
      companyHired: "",
      repName: "",
      repEmail: "",
      repPhone: "",
      companyAddress: "",
      companyCity: "",
      companyState: "",
      companyZip: "",
      priority: "med",
      status: "not_started",
      paymentStatus: "not_paid",
      dateOnSite: "",
      requiresOnSiteInspection: false,
      completedAt: "",
      cost: "",
      notes: "",
      showOnTimeline: false,
      isInternalTask: false,
      dependencies: [],
    });
    
    setStep("customize");
  };

  const handleBack = () => {
    setStep("browse");
    setSelectedTemplate(null);
    form.reset();
  };

  const handleClose = () => {
    setStep("browse");
    setSelectedTemplate(null);
    setSearchTerm("");
    setSelectedCategory("all");
    form.reset();
    onClose();
  };

  // Handler for when a company is selected from CRM
  const handleCompanySelect = (company: any) => {
    // Unconditionally set all company fields (clears stale data when empty)
    form.setValue("companyHired", company.name || "");
    form.setValue("companyAddress", company.address || "");
    form.setValue("repPhone", company.phone || "");
  };

  // Handler for when a contact is selected from CRM
  const handleContactSelect = (contact: any) => {
    // Unconditionally set all contact fields (clears stale data when empty)
    // Build full name and ensure it's properly trimmed (avoids single space when both empty)
    const fullName = (contact.firstName || contact.lastName)
      ? `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
      : "";
    form.setValue("repName", fullName);
    form.setValue("repEmail", contact.email || "");
    
    // Always set phone (use first from phones array, fallback to legacy phone field, or empty)
    const phoneNumber = (contact.phones && contact.phones.length > 0) 
      ? contact.phones[0].number || ""
      : contact.phone || "";
    form.setValue("repPhone", phoneNumber);
    
    // Unconditionally set all address fields
    form.setValue("companyAddress", contact.address || "");
    form.setValue("companyCity", contact.city || "");
    form.setValue("companyState", contact.state || "");
    form.setValue("companyZip", contact.zipCode || "");
  };

  const onSubmit = (data: z.infer<typeof addTaskFormSchema>) => {
    // Transform data for API to match backend schema expectations
    const transformedData = {
      ...data,
      // Convert completedAt string to Date object as backend expects Date
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      // Convert empty date strings to null for database compatibility
      startDate: data.startDate || null,
      deadline: data.deadline || null,
      // Set dateOnSite based on requiresOnSiteInspection checkbox
      dateOnSite: data.requiresOnSiteInspection ? (data.dateOnSite || "TBD") : null,
      // Ensure startOffsetDays is a number or null
      startOffsetDays: data.startOffsetDays ? Number(data.startOffsetDays) : null,
      // Ensure deadlineDays is a number or null
      deadlineDays: data.deadlineDays ? Number(data.deadlineDays) : null,
      // Convert empty string CRM IDs to null (must be UUID or null, not empty string)
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      // Remove fields that shouldn't be sent to backend
      isInternalTask: undefined, // This field doesn't exist in backend schema
    };

    if (isEditMode && editingTask) {
      // Update existing task with conflict detection
      updateTask.mutate(
        {
          id: editingTask.id,
          projectId,
          updates: transformedData,
          expectedUpdatedAt: editingTask.updatedAt,
        },
        {
          onSuccess: () => {
            toast({
              title: "Success",
              description: "Task updated successfully",
            });
            handleClose();
          },
          onError: (error: any) => {
            let errorMessage = "Failed to update task. Please try again.";
            if (error?.details && Array.isArray(error.details)) {
              const fieldErrors = error.details.map((d: any) => `${d.field}: ${d.message}`).join(', ');
              errorMessage = `Validation error: ${fieldErrors}`;
            } else if (error?.message) {
              errorMessage = error.message;
            }
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            });
            console.error("Task update error:", error);
          },
        }
      );
    } else {
      // Create new task
      const taskData = {
        ...transformedData,
        projectId,
        status: data.status, // Use the status selected by the user in the form
      };

      createTask.mutate(
        { projectId, task: taskData },
        {
          onSuccess: (createdTask) => {
            toast({
              title: "Success",
              description: "Task added successfully",
            });
            handleClose();
          },
          onError: (error) => {
            toast({
              title: "Error",
              description: "Failed to create task. Please try again.",
              variant: "destructive",
            });
            console.error("Task creation error:", error);
          },
        }
      );
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-800";
      case "med": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditMode 
                ? "Edit Task" 
                : step === "browse" 
                  ? "Add Due Diligence Task" 
                  : selectedTemplate ? `Customize: ${selectedTemplate.name}` : "Add Custom Task"
              }
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditMode 
              ? "Modify the task details and save your changes" 
              : step === "browse" 
                ? "Choose from our comprehensive marina due diligence task library" 
                : "Review and customize the task details before adding to your project"
            }
          </DialogDescription>
        </DialogHeader>

        {isEditMode ? (
          // Edit mode - show customize form directly
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-96 pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    data-testid="input-task-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    rows={3}
                    data-testid="textarea-task-description"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(value: string) => form.setValue("priority", value as "low" | "med" | "high")}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="med">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value: string) => {
                        form.setValue("status", value as any);
                        // Clear dateEngaged if status is not 'engaged'
                        if (value !== "engaged") {
                          form.setValue("dateEngaged", "");
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-gray-500" />
                            <span>Not Started</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="engaged">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span>Engaged</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="scheduled">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Scheduled</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-orange-500" />
                            <span>In Progress</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Completed</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paymentStatus">Payment</Label>
                    <Select
                      value={form.watch("paymentStatus")}
                      onValueChange={(value: string) => form.setValue("paymentStatus", value as "not_paid" | "paid" | "no_cost")}
                    >
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>Not Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="paid">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="no_cost">
                          <div className="flex items-center gap-2">
                            <MinusCircle className="h-4 w-4 text-gray-500" />
                            <span>No Cost</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.watch("status") === "completed" && (
                    <div>
                      <Label htmlFor="completedAt">Completion Date</Label>
                      <Input
                        id="completedAt"
                        type="date"
                        {...form.register("completedAt")}
                        data-testid="input-completion-date"
                      />
                    </div>
                  )}
                </div>

                {/* Conditional Date Engaged field when status is 'engaged' */}
                {form.watch("status") === "engaged" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="dateEngaged">Date Engaged *</Label>
                      <DateInput
                        id="dateEngaged"
                        value={form.watch("dateEngaged")}
                        onChange={(value) => form.setValue("dateEngaged", value)}
                        placeholder="MM/DD/YYYY - Type or click to enter date"
                        data-testid="input-date-engaged"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Type the date when the company was engaged for this task (e.g., 12/25/2024)
                      </p>
                    </div>
                  </div>
                )}

                {/* Checkboxes row - On-Site Inspection, Add to Timeline, and Internal Task */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* On-Site Inspection Checkbox - only for external tasks */}
                  {!form.watch("isInternalTask") && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresOnSiteInspection"
                        checked={form.watch("requiresOnSiteInspection")}
                        onCheckedChange={(checked) => {
                          form.setValue("requiresOnSiteInspection", !!checked);
                          // Clear dateOnSite if unchecked
                          if (!checked) {
                            form.setValue("dateOnSite", "");
                          }
                        }}
                        data-testid="checkbox-requires-onsite"
                      />
                      <Label 
                        htmlFor="requiresOnSiteInspection" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Requires On-Site Inspection
                      </Label>
                    </div>
                  )}

                  {/* Add to Timeline Checkbox - available for all tasks */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showOnTimeline"
                      checked={form.watch("showOnTimeline")}
                      onCheckedChange={(checked) => {
                        form.setValue("showOnTimeline", !!checked);
                      }}
                      data-testid="checkbox-add-to-timeline"
                    />
                    <Label 
                      htmlFor="showOnTimeline" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Add to Timeline
                    </Label>
                  </div>

                  {/* Internal Task Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isInternalTask"
                      checked={form.watch("isInternalTask")}
                      onCheckedChange={(checked) => {
                        form.setValue("isInternalTask", !!checked);
                        // Clear company fields and on-site fields when marking as internal
                        if (checked) {
                          form.setValue("companyId", "");
                          form.setValue("contactId", "");
                          form.setValue("companyHired", "");
                          form.setValue("repName", "");
                          form.setValue("repEmail", "");
                          form.setValue("repPhone", "");
                          form.setValue("companyAddress", "");
                          form.setValue("companySuite", "");
                          form.setValue("companyCity", "");
                          form.setValue("companyState", "");
                          form.setValue("companyZip", "");
                          form.setValue("requiresOnSiteInspection", false);
                          form.setValue("dateOnSite", "");
                        }
                      }}
                      data-testid="checkbox-internal-task"
                    />
                    <Label 
                      htmlFor="isInternalTask" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Internal Task (No Company)
                    </Label>
                  </div>

                  {/* Requires Decision Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requiresDecision"
                      checked={form.watch("requiresDecision")}
                      onCheckedChange={(checked) => {
                        form.setValue("requiresDecision", !!checked);
                      }}
                      data-testid="checkbox-requires-decision"
                    />
                    <Label 
                      htmlFor="requiresDecision" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Requires Decision
                    </Label>
                  </div>
                </div>

                {/* Conditional Date On-Site field when requires on-site inspection */}
                {!form.watch("isInternalTask") && form.watch("requiresOnSiteInspection") && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="dateOnSite">Date On-Site *</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="dateOnSiteTBD"
                            checked={form.watch("dateOnSite") === "TBD"}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                form.setValue("dateOnSite", "TBD");
                              } else {
                                form.setValue("dateOnSite", "");
                              }
                            }}
                            data-testid="checkbox-date-on-site-tbd"
                          />
                          <Label 
                            htmlFor="dateOnSiteTBD" 
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            TBD
                          </Label>
                        </div>
                      </div>
                      <Input
                        id="dateOnSite"
                        type="text"
                        placeholder="MM/DD/YYYY"
                        disabled={form.watch("dateOnSite") === "TBD"}
                        {...form.register("dateOnSite")}
                        value={form.watch("dateOnSite") === "TBD" ? "TBD" : form.watch("dateOnSite")}
                        onChange={(e) => {
                          if (form.watch("dateOnSite") !== "TBD") {
                            form.setValue("dateOnSite", e.target.value);
                          }
                        }}
                        data-testid="input-date-on-site"
                        pattern="^(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])/[0-9]{4}$"
                        title="Please enter date in MM/DD/YYYY format"
                        className={form.watch("dateOnSite") === "TBD" ? "bg-muted text-muted-foreground" : ""}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Check TBD if the on-site date is to be determined
                      </p>
                    </div>
                  </div>
                )}



                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="deadline">Deadline Date</Label>
                    <div className="flex gap-2">
                      <Input
                        id="deadline"
                        type="date"
                        {...form.register("deadline")}
                        data-testid="input-deadline"
                        className="flex-1"
                      />
                      <div className="flex gap-1">
                        {project?.ddExpirationDate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              form.setValue("deadline", project.ddExpirationDate!);
                            }}
                            className="px-2 text-xs whitespace-nowrap"
                            data-testid="button-dd-exp"
                          >
                            DD Exp
                          </Button>
                        )}
                        {project?.closingDate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              form.setValue("deadline", project.closingDate!);
                            }}
                            className="px-2 text-xs whitespace-nowrap"
                            data-testid="button-closing"
                          >
                            Closing
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Set a specific deadline date for this task
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignee">Task Owner</Label>
                    <TaskOwnerSelector 
                      projectId={projectId}
                      value={form.watch("assignee") || ""}
                      onChange={(value) => form.setValue("assignee", value)}
                    />
                  </div>

                  {!form.watch("isInternalTask") && (
                    <div>
                      <Label htmlFor="companyHired">Company</Label>
                      <CompanySelector 
                        value={form.watch("companyId") || ""}
                        onChange={(value) => form.setValue("companyId", value)}
                        onCompanySelect={handleCompanySelect}
                        manualValue={form.watch("companyHired") || ""}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Select from CRM or enter manually below
                      </p>
                    </div>
                  )}
                </div>

                {/* Task Dependencies Section */}
                <div className="space-y-2">
                  <Label htmlFor="dependencies">Task Dependencies</Label>
                  <TaskDependenciesSelector 
                    projectId={projectId}
                    value={form.watch("dependencies") || []}
                    onChange={(deps) => form.setValue("dependencies", deps, { shouldDirty: true })}
                    currentTaskId={editingTask?.id}
                  />
                  <p className="text-sm text-muted-foreground">
                    Select tasks that must be completed before this task can begin
                  </p>
                </div>

                {/* Rep Contact Info */}
                {!form.watch("isInternalTask") && form.watch("companyHired") && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700">Company Information</div>
                    <div className="grid grid-cols-1 gap-4">
                      {/* Rep Contact Section */}
                      <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Representative Contact</div>
                        <div>
                          <Label htmlFor="contactId">Contact</Label>
                          <ContactSelector 
                            companyId={form.watch("companyId") || undefined}
                            value={form.watch("contactId") || ""}
                            onChange={(value) => form.setValue("contactId", value)}
                            onContactSelect={handleContactSelect}
                            manualValue={form.watch("repName") || ""}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Select from CRM or enter manually below
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="repName">Rep Name</Label>
                          <Input
                            id="repName"
                            placeholder="Representative name"
                            {...form.register("repName")}
                            data-testid="input-rep-name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="repEmail">Rep Email</Label>
                            <Input
                              id="repEmail"
                              type="email"
                              placeholder="rep@company.com"
                              {...form.register("repEmail")}
                              data-testid="input-rep-email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="repPhone">Rep Phone</Label>
                            <Input
                              id="repPhone"
                              type="tel"
                              placeholder="(555) 123-4567"
                              {...form.register("repPhone")}
                              onBlur={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                form.setValue("repPhone", formatted);
                              }}
                              data-testid="input-rep-phone"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Company Address Section - Geocoding Ready Structure */}
                      <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center justify-between">
                          <span>Company Address</span>
                          {/* Placeholder Auto-fill Button - Ready for Future Geocoding Integration */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs opacity-50 cursor-not-allowed"
                            disabled
                            data-testid="button-autofill-address"
                            data-geocoding-trigger="true"
                            title="Auto-fill address (Coming Soon)"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Auto-fill
                          </Button>
                        </div>

                        <div 
                          className="space-y-3"
                          data-geocoding-container="true"
                          data-testid="container-address-geocoding"
                        >
                          <AddressInput
                            value={form.watch("companyAddress") || ""}
                            onChange={(value) => form.setValue("companyAddress", value, { shouldDirty: true })}
                            onAddressSelect={(components: AddressComponents) => {
                              form.setValue("companyAddress", components.streetAddress || components.fullAddress || '', { shouldDirty: true });
                              if (components.city) form.setValue("companyCity", components.city, { shouldDirty: true });
                              if (components.state) form.setValue("companyState", toStateAbbr(components.state), { shouldDirty: true });
                              if (components.zipCode) form.setValue("companyZip", components.zipCode, { shouldDirty: true });
                            }}
                            label="Street Address"
                            placeholder="Start typing an address..."
                            testId="input-company-address"
                          />
                          <div>
                            <Label htmlFor="companySuite">Suite/Unit</Label>
                            <Input
                              id="companySuite"
                              placeholder="Suite, Unit, or Floor"
                              {...form.register("companySuite")}
                              data-testid="input-company-suite"
                              data-geocoding-field="subpremise"
                              autoComplete="address-line2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="companyCity">City</Label>
                              <Input
                                id="companyCity"
                                placeholder="City"
                                {...form.register("companyCity")}
                                data-testid="input-company-city"
                                data-geocoding-field="locality"
                                autoComplete="address-level2"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="companyState">State</Label>
                                <Input
                                  id="companyState"
                                  placeholder="State"
                                  {...form.register("companyState")}
                                  onBlur={(e) => {
                                    const formatted = toStateAbbr(e.target.value);
                                    form.setValue("companyState", formatted);
                                  }}
                                  data-testid="input-company-state"
                                  data-geocoding-field="administrative_area_level_1"
                                  autoComplete="address-level1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="companyZip">ZIP Code</Label>
                                <Input
                                  id="companyZip"
                                  placeholder="12345"
                                  {...form.register("companyZip")}
                                  data-testid="input-company-zip"
                                  data-geocoding-field="postal_code"
                                  autoComplete="postal-code"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {form.watch("paymentStatus") !== "no_cost" && (
                  <div>
                    <Label htmlFor="cost">Estimated Cost</Label>
                    <Input
                      id="cost"
                      placeholder="e.g., 5000 or $5,000"
                      {...form.register("cost")}
                      onBlur={handleCostBlur}
                      data-testid="input-cost"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or requirements"
                    {...form.register("notes")}
                    rows={2}
                    data-testid="textarea-notes"
                  />
                </div>

                {/* Timeline Display Toggle */}
                <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showOnTimeline"
                      {...form.register("showOnTimeline")}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      data-testid="checkbox-show-on-timeline"
                    />
                    <Label htmlFor="showOnTimeline" className="text-sm font-medium text-gray-900">
                      Display on Timeline
                    </Label>
                  </div>
                  <p className="text-xs text-gray-600">
                    Show this task on the main project timeline overview
                  </p>
                </div>

              </div>
            </ScrollArea>


            {/* Form Actions */}
            <div className="flex justify-end pt-4">
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTask.isPending} data-testid="button-save-task">
                  {updateTask.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        ) : step === "browse" ? (
          <div className="space-y-4">
            {/* Create Custom Task Button */}
            <div className="flex justify-center p-4 bg-slate-50 rounded-lg border border-slate-200">
              <Button 
                onClick={handleCreateCustomTask}
                className="w-full max-w-sm"
                data-testid="button-create-custom-task"
              >
                Create Custom Task
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or choose from templates
                </span>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks, descriptions, or companies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-task-search"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-64" data-testid="select-task-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Task List */}
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks found. Try adjusting your search or category filter.
                  </div>
                ) : (
                  filteredTasks.map((task, index) => (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" data-testid={`task-template-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <CardTitle className="text-lg">{task.name}</CardTitle>
                            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                              {task.estimatedCost && (
                                <div className="flex items-center">
                                  <DollarSign className="w-4 h-4 mr-1" />
                                  {task.estimatedCost}
                                </div>
                              )}
                              <Badge className={getPriorityColor(task.priority)}>
                                {task.priority.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={() => handleTemplateSelect(task)}
                            data-testid={`button-select-task-${index}`}
                          >
                            Select
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{task.category}</Badge>
                          {task.typicalCompanies && task.typicalCompanies.length > 0 && (
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Users className="w-3 h-3 mr-1" />
                              {task.typicalCompanies[0]}
                              {task.typicalCompanies.length > 1 && ` +${task.typicalCompanies.length - 1} more`}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        ) : (
          /* Customize Form */
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-96 pr-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    {...form.register("title")}
                    data-testid="input-task-title"
                  />
                  {form.formState.errors.title && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    rows={3}
                    data-testid="textarea-task-description"
                  />
                </div>


                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={form.watch("priority")}
                      onValueChange={(value: string) => form.setValue("priority", value as "low" | "med" | "high")}
                    >
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="med">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={form.watch("status")}
                      onValueChange={(value: string) => {
                        form.setValue("status", value as any);
                        // Clear dateEngaged if status is not 'engaged'
                        if (value !== "engaged") {
                          form.setValue("dateEngaged", "");
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">
                          <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-gray-500" />
                            <span>Not Started</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="engaged">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-purple-500" />
                            <span>Engaged</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="scheduled">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-500" />
                            <span>Scheduled</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="in_progress">
                          <div className="flex items-center gap-2">
                            <Play className="h-4 w-4 text-orange-500" />
                            <span>In Progress</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Completed</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="paymentStatus">Payment</Label>
                    <Select
                      value={form.watch("paymentStatus")}
                      onValueChange={(value: string) => form.setValue("paymentStatus", value as "not_paid" | "paid" | "no_cost")}
                    >
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_paid">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <span>Not Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="paid">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>Paid</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="no_cost">
                          <div className="flex items-center gap-2">
                            <MinusCircle className="h-4 w-4 text-gray-500" />
                            <span>No Cost</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.watch("status") === "completed" && (
                    <div>
                      <Label htmlFor="completedAt">Completion Date</Label>
                      <Input
                        id="completedAt"
                        type="date"
                        {...form.register("completedAt")}
                        data-testid="input-completion-date"
                      />
                    </div>
                  )}
                </div>

                {/* Conditional Date Engaged field when status is 'engaged' */}
                {form.watch("status") === "engaged" && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Label htmlFor="dateEngaged">Date Engaged *</Label>
                      <DateInput
                        id="dateEngaged"
                        value={form.watch("dateEngaged")}
                        onChange={(value) => form.setValue("dateEngaged", value)}
                        placeholder="MM/DD/YYYY - Type or click to enter date"
                        data-testid="input-date-engaged"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Type the date when the company was engaged for this task (e.g., 12/25/2024)
                      </p>
                    </div>
                  </div>
                )}

                {/* Checkboxes row - On-Site Inspection, Add to Timeline, and Internal Task */}
                <div className="flex flex-wrap items-center gap-6">
                  {/* On-Site Inspection Checkbox - only for external tasks */}
                  {!form.watch("isInternalTask") && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requiresOnSiteInspection"
                        checked={form.watch("requiresOnSiteInspection")}
                        onCheckedChange={(checked) => {
                          form.setValue("requiresOnSiteInspection", !!checked);
                          // Clear dateOnSite if unchecked
                          if (!checked) {
                            form.setValue("dateOnSite", "");
                          }
                        }}
                        data-testid="checkbox-requires-onsite"
                      />
                      <Label 
                        htmlFor="requiresOnSiteInspection" 
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Requires On-Site Inspection
                      </Label>
                    </div>
                  )}

                  {/* Add to Timeline Checkbox - available for all tasks */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showOnTimeline"
                      checked={form.watch("showOnTimeline")}
                      onCheckedChange={(checked) => {
                        form.setValue("showOnTimeline", !!checked);
                      }}
                      data-testid="checkbox-add-to-timeline"
                    />
                    <Label 
                      htmlFor="showOnTimeline" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Add to Timeline
                    </Label>
                  </div>

                  {/* Internal Task Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isInternalTask"
                      checked={form.watch("isInternalTask")}
                      onCheckedChange={(checked) => {
                        form.setValue("isInternalTask", !!checked);
                        // Clear company fields and on-site fields when marking as internal
                        if (checked) {
                          form.setValue("companyId", "");
                          form.setValue("contactId", "");
                          form.setValue("companyHired", "");
                          form.setValue("repName", "");
                          form.setValue("repEmail", "");
                          form.setValue("repPhone", "");
                          form.setValue("companyAddress", "");
                          form.setValue("companySuite", "");
                          form.setValue("companyCity", "");
                          form.setValue("companyState", "");
                          form.setValue("companyZip", "");
                          form.setValue("requiresOnSiteInspection", false);
                          form.setValue("dateOnSite", "");
                        }
                      }}
                      data-testid="checkbox-internal-task"
                    />
                    <Label 
                      htmlFor="isInternalTask" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Internal Task (No Company)
                    </Label>
                  </div>

                  {/* Requires Decision Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="requiresDecision"
                      checked={form.watch("requiresDecision")}
                      onCheckedChange={(checked) => {
                        form.setValue("requiresDecision", !!checked);
                      }}
                      data-testid="checkbox-requires-decision"
                    />
                    <Label 
                      htmlFor="requiresDecision" 
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Requires Decision
                    </Label>
                  </div>
                </div>

                {/* Conditional Date On-Site field when requires on-site inspection */}
                {!form.watch("isInternalTask") && form.watch("requiresOnSiteInspection") && (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="dateOnSite">Date On-Site *</Label>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="dateOnSiteTBD"
                            checked={form.watch("dateOnSite") === "TBD"}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                form.setValue("dateOnSite", "TBD");
                              } else {
                                form.setValue("dateOnSite", "");
                              }
                            }}
                            data-testid="checkbox-date-on-site-tbd"
                          />
                          <Label 
                            htmlFor="dateOnSiteTBD" 
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            TBD
                          </Label>
                        </div>
                      </div>
                      <Input
                        id="dateOnSite"
                        type="text"
                        placeholder="MM/DD/YYYY"
                        disabled={form.watch("dateOnSite") === "TBD"}
                        {...form.register("dateOnSite")}
                        value={form.watch("dateOnSite") === "TBD" ? "TBD" : form.watch("dateOnSite")}
                        onChange={(e) => {
                          if (form.watch("dateOnSite") !== "TBD") {
                            form.setValue("dateOnSite", e.target.value);
                          }
                        }}
                        data-testid="input-date-on-site"
                        pattern="^(0[1-9]|1[012])/(0[1-9]|[12][0-9]|3[01])/[0-9]{4}$"
                        title="Please enter date in MM/DD/YYYY format"
                        className={form.watch("dateOnSite") === "TBD" ? "bg-muted text-muted-foreground" : ""}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Check TBD if the on-site date is to be determined
                      </p>
                    </div>
                  </div>
                )}



                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="deadline">Deadline Date</Label>
                    <div className="flex gap-2">
                      <Input
                        id="deadline"
                        type="date"
                        {...form.register("deadline")}
                        data-testid="input-deadline"
                        className="flex-1"
                      />
                      <div className="flex gap-1">
                        {project?.ddExpirationDate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              form.setValue("deadline", project.ddExpirationDate!);
                            }}
                            className="px-2 text-xs whitespace-nowrap"
                            data-testid="button-dd-exp"
                          >
                            DD Exp
                          </Button>
                        )}
                        {project?.closingDate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              form.setValue("deadline", project.closingDate!);
                            }}
                            className="px-2 text-xs whitespace-nowrap"
                            data-testid="button-closing"
                          >
                            Closing
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Set a specific deadline date for this task
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="assignee">Task Owner</Label>
                    <TaskOwnerSelector 
                      projectId={projectId}
                      value={form.watch("assignee") || ""}
                      onChange={(value) => form.setValue("assignee", value)}
                    />
                  </div>

                  {!form.watch("isInternalTask") && (
                    <div>
                      <Label htmlFor="companyHired">Company</Label>
                      <CompanySelector 
                        value={form.watch("companyId") || ""}
                        onChange={(value) => form.setValue("companyId", value)}
                        onCompanySelect={handleCompanySelect}
                        manualValue={form.watch("companyHired") || ""}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Select from CRM or enter manually below
                      </p>
                    </div>
                  )}
                </div>

                {/* Task Dependencies Section */}
                <div className="space-y-2">
                  <Label htmlFor="dependencies">Task Dependencies</Label>
                  <TaskDependenciesSelector 
                    projectId={projectId}
                    value={form.watch("dependencies") || []}
                    onChange={(deps) => form.setValue("dependencies", deps, { shouldDirty: true })}
                    currentTaskId={editingTask?.id}
                  />
                  <p className="text-sm text-muted-foreground">
                    Select tasks that must be completed before this task can begin
                  </p>
                </div>

                {/* Rep Contact Info */}
                {!form.watch("isInternalTask") && form.watch("companyHired") && (
                  <div className="space-y-3 bg-gray-50 p-3 rounded-md">
                    <div className="text-sm font-medium text-gray-700">Company Information</div>
                    <div className="grid grid-cols-1 gap-4">
                      {/* Rep Contact Section */}
                      <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Representative Contact</div>
                        <div>
                          <Label htmlFor="contactId">Contact</Label>
                          <ContactSelector 
                            companyId={form.watch("companyId") || undefined}
                            value={form.watch("contactId") || ""}
                            onChange={(value) => form.setValue("contactId", value)}
                            onContactSelect={handleContactSelect}
                            manualValue={form.watch("repName") || ""}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Select from CRM or enter manually below
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="repName">Rep Name</Label>
                          <Input
                            id="repName"
                            placeholder="Representative name"
                            {...form.register("repName")}
                            data-testid="input-rep-name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="repEmail">Rep Email</Label>
                            <Input
                              id="repEmail"
                              type="email"
                              placeholder="rep@company.com"
                              {...form.register("repEmail")}
                              data-testid="input-rep-email"
                            />
                          </div>
                          <div>
                            <Label htmlFor="repPhone">Rep Phone</Label>
                            <Input
                              id="repPhone"
                              type="tel"
                              placeholder="(555) 123-4567"
                              {...form.register("repPhone")}
                              onBlur={(e) => {
                                const formatted = formatPhoneNumber(e.target.value);
                                form.setValue("repPhone", formatted);
                              }}
                              data-testid="input-rep-phone"
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Company Address Section - Geocoding Ready Structure */}
                      <div className="space-y-3">
                        <div className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center justify-between">
                          <span>Company Address</span>
                          {/* Placeholder Auto-fill Button - Ready for Future Geocoding Integration */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs opacity-50 cursor-not-allowed"
                            disabled
                            data-testid="button-autofill-address"
                            data-geocoding-trigger="true"
                            title="Auto-fill address (Coming Soon)"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Auto-fill
                          </Button>
                        </div>

                        <div 
                          className="space-y-3"
                          data-geocoding-container="true"
                          data-testid="container-address-geocoding"
                        >
                          <AddressInput
                            value={form.watch("companyAddress") || ""}
                            onChange={(value) => form.setValue("companyAddress", value, { shouldDirty: true })}
                            onAddressSelect={(components: AddressComponents) => {
                              form.setValue("companyAddress", components.streetAddress || components.fullAddress || '', { shouldDirty: true });
                              if (components.city) form.setValue("companyCity", components.city, { shouldDirty: true });
                              if (components.state) form.setValue("companyState", toStateAbbr(components.state), { shouldDirty: true });
                              if (components.zipCode) form.setValue("companyZip", components.zipCode, { shouldDirty: true });
                            }}
                            label="Street Address"
                            placeholder="Start typing an address..."
                            testId="input-company-address"
                          />
                          <div>
                            <Label htmlFor="companySuite">Suite/Unit</Label>
                            <Input
                              id="companySuite"
                              placeholder="Suite, Unit, or Floor"
                              {...form.register("companySuite")}
                              data-testid="input-company-suite"
                              data-geocoding-field="subpremise"
                              autoComplete="address-line2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="companyCity">City</Label>
                              <Input
                                id="companyCity"
                                placeholder="City"
                                {...form.register("companyCity")}
                                data-testid="input-company-city"
                                data-geocoding-field="locality"
                                autoComplete="address-level2"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label htmlFor="companyState">State</Label>
                                <Input
                                  id="companyState"
                                  placeholder="State"
                                  {...form.register("companyState")}
                                  onBlur={(e) => {
                                    const formatted = toStateAbbr(e.target.value);
                                    form.setValue("companyState", formatted);
                                  }}
                                  data-testid="input-company-state"
                                  data-geocoding-field="administrative_area_level_1"
                                  autoComplete="address-level1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="companyZip">ZIP Code</Label>
                                <Input
                                  id="companyZip"
                                  placeholder="12345"
                                  {...form.register("companyZip")}
                                  data-testid="input-company-zip"
                                  data-geocoding-field="postal_code"
                                  autoComplete="postal-code"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {form.watch("paymentStatus") !== "no_cost" && (
                  <div>
                    <Label htmlFor="cost">Estimated Cost</Label>
                    <Input
                      id="cost"
                      placeholder="e.g., 5000 or $5,000"
                      {...form.register("cost")}
                      onBlur={handleCostBlur}
                      data-testid="input-cost"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or requirements"
                    {...form.register("notes")}
                    rows={2}
                    data-testid="textarea-notes"
                  />
                </div>

                {/* File Attachments - Only show when editing existing task */}
                {editingTask && editingTask.id && (
                  <div className="space-y-2">
                    <TaskFiles 
                      taskId={editingTask.id} 
                      taskTitle={editingTask.title || ''}
                      compact={true}
                    />
                  </div>
                )}

                {/* Template Info */}
                {selectedTemplate && selectedTemplate.typicalCompanies && (
                  <div className="bg-blue-50 p-3 rounded-md">
                    <div className="flex items-center mb-2">
                      <AlertCircle className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-sm font-medium text-blue-900">Typical Companies for this task:</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      {selectedTemplate.typicalCompanies.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Form Actions */}
            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={handleBack} data-testid="button-back">
                Back to Browse
              </Button>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" onClick={handleClose} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createTask.isPending} data-testid="button-add-task">
                  {createTask.isPending ? "Adding..." : selectedTemplate ? "Add Task from Template" : "Add Custom Task"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}