import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  FileText, 
  Send, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Plus,
  Eye,
  Pen,
  Download,
  AlertTriangle,
  FileSignature,
  User
} from "lucide-react";
import type { Contract, ContractTemplate, Customer } from "@shared/schema";

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-yellow-500", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500", icon: Send },
  signed: { label: "Signed", color: "bg-green-500", icon: CheckCircle },
  expired: { label: "Expired", color: "bg-red-500", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "bg-gray-500", icon: XCircle },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  transient_agreement: "Transient Agreement",
  slip_lease: "Slip Lease",
  dry_storage: "Dry Storage",
  mooring: "Mooring Agreement",
  winter_storage: "Winter Storage",
};

export default function Contracts() {
  const { toast } = useToast();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: contracts, isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: pendingContracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/pending/expiring", { days: 7 }],
  });

  const sendContractMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return await apiRequest(`/api/contracts/${contractId}/send`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Contract Sent",
        description: "The contract has been sent to the customer for signing.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send contract",
        variant: "destructive",
      });
    },
  });

  const signContractMutation = useMutation({
    mutationFn: async ({ contractId, signedBy, signatureImageUrl }: { 
      contractId: string; 
      signedBy: string; 
      signatureImageUrl?: string;
    }) => {
      return await apiRequest(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        body: JSON.stringify({ signedBy, signatureImageUrl }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setSignatureDialogOpen(false);
      toast({
        title: "Contract Signed",
        description: "The contract has been signed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign contract",
        variant: "destructive",
      });
    },
  });

  const generateContractMutation = useMutation({
    mutationFn: async ({ templateId, customerId }: { templateId: string; customerId: string }) => {
      return await apiRequest("/api/contracts/generate", {
        method: "POST",
        body: JSON.stringify({ templateId, customerId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setCreateDialogOpen(false);
      setSelectedCustomerId("");
      setSelectedTemplateId("");
      toast({
        title: "Contract Created",
        description: "A new contract has been generated from the template.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate contract",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const config = CONTRACT_STATUS_CONFIG[status] || CONTRACT_STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const pendingCount = contracts?.filter(c => c.status === "pending").length || 0;
  const sentCount = contracts?.filter(c => c.status === "sent").length || 0;
  const signedCount = contracts?.filter(c => c.status === "signed").length || 0;
  const expiringCount = pendingContracts?.length || 0;

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  };

  const handleSign = () => {
    if (!selectedContract) return;
    
    const canvas = canvasRef.current;
    const signatureImageUrl = canvas?.toDataURL("image/png");
    
    const customer = customers?.find(c => c.id === selectedContract.customerId);
    const signedBy = customer ? `${customer.firstName} ${customer.lastName}` : "Customer";
    
    signContractMutation.mutate({
      contractId: selectedContract.id,
      signedBy,
      signatureImageUrl,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Contracts & E-Signatures</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Manage digital lease agreements, contracts, and electronic signatures
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-contract" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Contract
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Contract</DialogTitle>
                <DialogDescription>
                  Generate a contract from a template for a customer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Customer</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger data-testid="select-customer">
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.firstName} {customer.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Contract Template</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({CONTRACT_TYPE_LABELS[template.contractType] || template.contractType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  data-testid="button-generate-contract"
                  onClick={() => generateContractMutation.mutate({
                    templateId: selectedTemplateId,
                    customerId: selectedCustomerId,
                  })}
                  disabled={!selectedCustomerId || !selectedTemplateId || generateContractMutation.isPending}
                >
                  {generateContractMutation.isPending ? "Generating..." : "Generate Contract"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-8 w-8 text-yellow-500" />
                <span className="text-3xl font-bold" data-testid="text-pending-count">{pendingCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Send className="h-8 w-8 text-blue-500" />
                <span className="text-3xl font-bold" data-testid="text-sent-count">{sentCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <span className="text-3xl font-bold" data-testid="text-signed-count">{signedCount}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-orange-500" />
                <span className="text-3xl font-bold" data-testid="text-expiring-count">{expiringCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All Contracts</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="sent" data-testid="tab-sent">Sent</TabsTrigger>
            <TabsTrigger value="signed" data-testid="tab-signed">Signed</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Contracts</CardTitle>
                <CardDescription>View and manage all contracts</CardDescription>
              </CardHeader>
              <CardContent>
                {contractsLoading ? (
                  <div className="text-center py-8 text-slate-500">Loading contracts...</div>
                ) : contracts?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No contracts yet. Create your first contract to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts?.map((contract) => {
                        const customer = customers?.find(c => c.id === contract.customerId);
                        return (
                          <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" />
                                {customer ? `${customer.firstName} ${customer.lastName}` : "Unknown"}
                              </div>
                            </TableCell>
                            <TableCell>{CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}</TableCell>
                            <TableCell>{getStatusBadge(contract.status)}</TableCell>
                            <TableCell>{contract.createdAt ? format(new Date(contract.createdAt), "MMM dd, yyyy") : "-"}</TableCell>
                            <TableCell>
                              {contract.expiresAt ? format(new Date(contract.expiresAt), "MMM dd, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-view-${contract.id}`}
                                  onClick={() => {
                                    setSelectedContract(contract);
                                    setPreviewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {contract.status === "pending" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-send-${contract.id}`}
                                    onClick={() => sendContractMutation.mutate(contract.id)}
                                    disabled={sendContractMutation.isPending}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                                {contract.status === "sent" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    data-testid={`button-sign-${contract.id}`}
                                    onClick={() => {
                                      setSelectedContract(contract);
                                      setSignatureDialogOpen(true);
                                      setTimeout(clearSignature, 100);
                                    }}
                                  >
                                    <Pen className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Contracts</CardTitle>
                <CardDescription>Contracts awaiting to be sent</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractList 
                  contracts={contracts?.filter(c => c.status === "pending")} 
                  customers={customers}
                  onView={(c) => { setSelectedContract(c); setPreviewDialogOpen(true); }}
                  onSend={(id) => sendContractMutation.mutate(id)}
                  sendPending={sendContractMutation.isPending}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sent">
            <Card>
              <CardHeader>
                <CardTitle>Sent Contracts</CardTitle>
                <CardDescription>Contracts awaiting customer signature</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractList 
                  contracts={contracts?.filter(c => c.status === "sent")} 
                  customers={customers}
                  onView={(c) => { setSelectedContract(c); setPreviewDialogOpen(true); }}
                  onSign={(c) => {
                    setSelectedContract(c);
                    setSignatureDialogOpen(true);
                    setTimeout(clearSignature, 100);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signed">
            <Card>
              <CardHeader>
                <CardTitle>Signed Contracts</CardTitle>
                <CardDescription>Completed contracts with signatures</CardDescription>
              </CardHeader>
              <CardContent>
                <ContractList 
                  contracts={contracts?.filter(c => c.status === "signed")} 
                  customers={customers}
                  onView={(c) => { setSelectedContract(c); setPreviewDialogOpen(true); }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Contract Templates</CardTitle>
                <CardDescription>Manage reusable contract templates</CardDescription>
              </CardHeader>
              <CardContent>
                {templates?.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No templates yet. Create templates to generate contracts quickly.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates?.map((template) => (
                        <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                          <TableCell className="font-medium">{template.name}</TableCell>
                          <TableCell>{CONTRACT_TYPE_LABELS[template.contractType] || template.contractType}</TableCell>
                          <TableCell>{template.version || "1.0"}</TableCell>
                          <TableCell>
                            <Badge variant={template.isActive ? "default" : "secondary"}>
                              {template.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {template.createdAt ? format(new Date(template.createdAt), "MMM dd, yyyy") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Contract Details</DialogTitle>
              <DialogDescription>
                {selectedContract && (CONTRACT_TYPE_LABELS[selectedContract.contractType] || selectedContract.contractType)}
              </DialogDescription>
            </DialogHeader>
            {selectedContract && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedContract.status)}
                  {selectedContract.signedAt && (
                    <span className="text-sm text-slate-500">
                      Signed on {format(new Date(selectedContract.signedAt), "MMM dd, yyyy 'at' h:mm a")}
                    </span>
                  )}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500">Customer</Label>
                    <p className="font-medium">
                      {customers?.find(c => c.id === selectedContract.customerId)?.firstName}{" "}
                      {customers?.find(c => c.id === selectedContract.customerId)?.lastName}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Contract Type</Label>
                    <p className="font-medium">
                      {CONTRACT_TYPE_LABELS[selectedContract.contractType] || selectedContract.contractType}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Created</Label>
                    <p className="font-medium">
                      {selectedContract.createdAt ? format(new Date(selectedContract.createdAt), "MMM dd, yyyy") : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-slate-500">Expires</Label>
                    <p className="font-medium">
                      {selectedContract.expiresAt ? format(new Date(selectedContract.expiresAt), "MMM dd, yyyy") : "-"}
                    </p>
                  </div>
                </div>
                {selectedContract.signatureData && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-slate-500">Signature Details</Label>
                      <div className="mt-2 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm">
                          <strong>Signed by:</strong> {selectedContract.signatureData.signedBy}
                        </p>
                        <p className="text-sm">
                          <strong>Date:</strong> {selectedContract.signatureData.signedAt}
                        </p>
                        {selectedContract.signatureData.signatureImageUrl && (
                          <div className="mt-2">
                            <p className="text-sm font-medium mb-1">Signature:</p>
                            <img 
                              src={selectedContract.signatureData.signatureImageUrl} 
                              alt="Signature" 
                              className="border border-slate-300 rounded bg-white max-h-20"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Sign Contract</DialogTitle>
              <DialogDescription>
                Draw your signature below to sign this contract.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border border-slate-300 rounded-lg bg-white">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={150}
                  className="w-full cursor-crosshair"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  data-testid="canvas-signature"
                />
              </div>
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={clearSignature} data-testid="button-clear-signature">
                  Clear
                </Button>
                <p className="text-sm text-slate-500">
                  By signing, you agree to the terms and conditions.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSignatureDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSign}
                disabled={signContractMutation.isPending}
                data-testid="button-submit-signature"
              >
                {signContractMutation.isPending ? "Signing..." : "Sign Contract"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function ContractList({ 
  contracts, 
  customers,
  onView,
  onSend,
  onSign,
  sendPending,
}: {
  contracts?: Contract[];
  customers?: Customer[];
  onView: (contract: Contract) => void;
  onSend?: (id: string) => void;
  onSign?: (contract: Contract) => void;
  sendPending?: boolean;
}) {
  if (!contracts?.length) {
    return (
      <div className="text-center py-8 text-slate-500">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No contracts in this category.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Customer</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((contract) => {
          const customer = customers?.find(c => c.id === contract.customerId);
          return (
            <TableRow key={contract.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  {customer ? `${customer.firstName} ${customer.lastName}` : "Unknown"}
                </div>
              </TableCell>
              <TableCell>{CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType}</TableCell>
              <TableCell>{contract.createdAt ? format(new Date(contract.createdAt), "MMM dd, yyyy") : "-"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onView(contract)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {onSend && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSend(contract.id)}
                      disabled={sendPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  {onSign && (
                    <Button variant="ghost" size="sm" onClick={() => onSign(contract)}>
                      <Pen className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
