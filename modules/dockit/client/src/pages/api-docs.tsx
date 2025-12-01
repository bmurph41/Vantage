import { useState } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Code, 
  Key, 
  Webhook, 
  Copy, 
  Check,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Globe,
  Lock,
  FileText,
  Zap,
  Server,
  Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_ENDPOINTS = [
  {
    category: "Reservations",
    endpoints: [
      { method: "GET", path: "/api/reservations", description: "List all reservations" },
      { method: "GET", path: "/api/reservations/:id", description: "Get reservation by ID" },
      { method: "POST", path: "/api/reservations", description: "Create a new reservation" },
      { method: "PATCH", path: "/api/reservations/:id", description: "Update a reservation" },
      { method: "DELETE", path: "/api/reservations/:id", description: "Cancel a reservation" },
    ],
  },
  {
    category: "Customers",
    endpoints: [
      { method: "GET", path: "/api/customers", description: "List all customers" },
      { method: "GET", path: "/api/customers/:id", description: "Get customer by ID" },
      { method: "POST", path: "/api/customers", description: "Create a new customer" },
      { method: "PATCH", path: "/api/customers/:id", description: "Update a customer" },
    ],
  },
  {
    category: "Slips",
    endpoints: [
      { method: "GET", path: "/api/slips", description: "List all slips" },
      { method: "GET", path: "/api/slips/:id", description: "Get slip by ID" },
      { method: "GET", path: "/api/slips/available", description: "Get available slips" },
      { method: "POST", path: "/api/slips", description: "Create a new slip" },
      { method: "PATCH", path: "/api/slips/:id", description: "Update a slip" },
    ],
  },
  {
    category: "Leases",
    endpoints: [
      { method: "GET", path: "/api/leases", description: "List all leases" },
      { method: "GET", path: "/api/leases/active", description: "List active leases" },
      { method: "POST", path: "/api/leases", description: "Create a new lease" },
      { method: "PUT", path: "/api/leases/:id", description: "Update a lease" },
    ],
  },
  {
    category: "Launches",
    endpoints: [
      { method: "GET", path: "/api/launches", description: "List all launches" },
      { method: "GET", path: "/api/launches/today", description: "Get today's launches" },
      { method: "GET", path: "/api/launches/upcoming", description: "Get upcoming launches" },
      { method: "POST", path: "/api/launches", description: "Schedule a launch" },
      { method: "PATCH", path: "/api/launches/:id", description: "Update a launch" },
    ],
  },
  {
    category: "Payments",
    endpoints: [
      { method: "GET", path: "/api/payments", description: "List all payments" },
      { method: "GET", path: "/api/payments/overdue", description: "Get overdue payments" },
      { method: "POST", path: "/api/payments", description: "Record a payment" },
      { method: "POST", path: "/api/payments/:id/process", description: "Process a payment via Stripe" },
    ],
  },
  {
    category: "Contracts",
    endpoints: [
      { method: "GET", path: "/api/contracts", description: "List all contracts" },
      { method: "GET", path: "/api/contracts/:id", description: "Get contract by ID" },
      { method: "POST", path: "/api/contracts", description: "Create a new contract" },
      { method: "POST", path: "/api/contracts/:id/send", description: "Send contract for signing" },
      { method: "POST", path: "/api/contracts/:id/sign", description: "Sign a contract" },
    ],
  },
  {
    category: "Analytics",
    endpoints: [
      { method: "GET", path: "/api/dashboard/stats", description: "Get dashboard statistics" },
      { method: "GET", path: "/api/analytics/portfolio/metrics", description: "Get portfolio metrics" },
      { method: "GET", path: "/api/analytics/marinas/:id/metrics", description: "Get marina-specific metrics" },
      { method: "GET", path: "/api/audit-logs", description: "Get audit logs" },
      { method: "GET", path: "/api/audit-logs/export", description: "Export audit logs" },
    ],
  },
];

const WEBHOOK_EVENTS = [
  { event: "reservation.created", description: "A new reservation was created" },
  { event: "reservation.updated", description: "A reservation was modified" },
  { event: "reservation.cancelled", description: "A reservation was cancelled" },
  { event: "payment.received", description: "A payment was successfully processed" },
  { event: "payment.failed", description: "A payment attempt failed" },
  { event: "payment.overdue", description: "A payment became overdue" },
  { event: "launch.scheduled", description: "A new launch was scheduled" },
  { event: "launch.completed", description: "A launch was completed" },
  { event: "contract.signed", description: "A contract was signed" },
  { event: "customer.created", description: "A new customer was added" },
];

export default function ApiDocs() {
  const { toast } = useToast();
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedEndpoint(text);
    setTimeout(() => setCopiedEndpoint(null), 2000);
    toast({
      title: "Copied",
      description: "Endpoint copied to clipboard",
    });
  };

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-500",
      POST: "bg-blue-500",
      PUT: "bg-yellow-500",
      PATCH: "bg-orange-500",
      DELETE: "bg-red-500",
    };
    return (
      <Badge className={`${colors[method] || "bg-gray-500"} text-white font-mono`}>
        {method}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">API Documentation</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              RESTful API reference, authentication, and webhook configuration
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Server className="h-4 w-4" />
                Base URL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <code className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                {window.location.origin}/api
              </code>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Authentication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Session-based or API Key</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Rate Limit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">1000 requests/hour</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="endpoints" className="space-y-4">
          <TabsList>
            <TabsTrigger value="endpoints" data-testid="tab-endpoints">
              <Code className="h-4 w-4 mr-2" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="authentication" data-testid="tab-auth">
              <Key className="h-4 w-4 mr-2" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="webhooks" data-testid="tab-webhooks">
              <Webhook className="h-4 w-4 mr-2" />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="examples" data-testid="tab-examples">
              <FileText className="h-4 w-4 mr-2" />
              Examples
            </TabsTrigger>
          </TabsList>

          <TabsContent value="endpoints">
            <Card>
              <CardHeader>
                <CardTitle>API Endpoints</CardTitle>
                <CardDescription>
                  Complete reference of available REST API endpoints
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {API_ENDPOINTS.map((category) => (
                    <AccordionItem key={category.category} value={category.category}>
                      <AccordionTrigger className="text-lg font-semibold">
                        {category.category}
                        <Badge variant="outline" className="ml-2">
                          {category.endpoints.length} endpoints
                        </Badge>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24">Method</TableHead>
                              <TableHead>Endpoint</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="w-16">Copy</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {category.endpoints.map((endpoint) => (
                              <TableRow key={`${endpoint.method}-${endpoint.path}`}>
                                <TableCell>{getMethodBadge(endpoint.method)}</TableCell>
                                <TableCell className="font-mono text-sm">
                                  {endpoint.path}
                                </TableCell>
                                <TableCell className="text-slate-600 dark:text-slate-400">
                                  {endpoint.description}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(endpoint.path)}
                                    data-testid={`button-copy-${endpoint.path.replace(/\//g, '-')}`}
                                  >
                                    {copiedEndpoint === endpoint.path ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="authentication">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Authentication Methods</CardTitle>
                  <CardDescription>
                    How to authenticate with the Marina Manager API
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Session-Based Authentication
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      For browser-based applications, use cookie-based session authentication.
                      Sessions are managed automatically through the login flow.
                    </p>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// Login to establish session
POST /api/login
Content-Type: application/json

{
  "email": "user@marina.com",
  "password": "your-password"
}

// Session cookie is automatically set
// All subsequent requests include the session cookie`}
                    </pre>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      API Key Authentication
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      For server-to-server integrations, use API keys with the X-API-Key header.
                    </p>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// Include API key in request header
GET /api/reservations
X-API-Key: mk_live_xxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

// Example with cURL
curl -X GET "https://your-marina.replit.app/api/reservations" \\
  -H "X-API-Key: mk_live_xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json"`}
                    </pre>
                  </div>

                  <Separator />

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      Security Best Practices
                    </h4>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• Never expose API keys in client-side code</li>
                      <li>• Rotate API keys regularly</li>
                      <li>• Use environment variables to store keys</li>
                      <li>• Set appropriate permissions for each API key</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="webhooks">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Webhook Events</CardTitle>
                  <CardDescription>
                    Subscribe to real-time event notifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {WEBHOOK_EVENTS.map((event) => (
                        <TableRow key={event.event}>
                          <TableCell className="font-mono text-sm">
                            <Badge variant="outline">{event.event}</Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-400">
                            {event.description}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Webhook Payload Format</CardTitle>
                  <CardDescription>
                    Example webhook payload structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`{
  "id": "evt_1234567890",
  "type": "reservation.created",
  "created": "2024-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "res_abc123",
      "customer_id": "cust_xyz789",
      "slip_id": "slip_456",
      "check_in": "2024-02-01",
      "check_out": "2024-02-05",
      "status": "confirmed",
      "total_amount": 500.00
    }
  },
  "marina_id": "mar_123",
  "organization_id": "org_456"
}`}
                  </pre>

                  <div className="mt-6">
                    <h4 className="font-semibold mb-2">Webhook Signature Verification</h4>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      All webhooks include an HMAC-SHA256 signature in the X-Webhook-Signature header.
                    </p>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// Verify webhook signature (Node.js example)
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="examples">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Code Examples</CardTitle>
                  <CardDescription>
                    Common API usage patterns
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Create a Reservation</h3>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// JavaScript/fetch example
const response = await fetch('/api/reservations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'mk_live_xxxxxxxxxxxxxxxxxxxx'
  },
  body: JSON.stringify({
    customerId: 'cust_123',
    slipId: 'slip_456',
    checkInDate: '2024-02-01',
    checkOutDate: '2024-02-05',
    boatId: 'boat_789',
    specialRequests: 'Early check-in if available'
  })
});

const reservation = await response.json();
console.log('Created reservation:', reservation.id);`}
                    </pre>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">List Payments with Filters</h3>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// Get overdue payments for a specific customer
const params = new URLSearchParams({
  customerId: 'cust_123',
  status: 'overdue',
  limit: '50'
});

const response = await fetch(\`/api/payments?\${params}\`, {
  headers: {
    'X-API-Key': 'mk_live_xxxxxxxxxxxxxxxxxxxx'
  }
});

const payments = await response.json();
console.log(\`Found \${payments.length} overdue payments\`);`}
                    </pre>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Export Data (CSV)</h3>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// Export audit logs as CSV
const params = new URLSearchParams({
  format: 'csv',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  marinaId: 'mar_123'
});

// Open in new tab to trigger download
window.open(\`/api/audit-logs/export?\${params}\`, '_blank');

// Or fetch programmatically
const response = await fetch(\`/api/audit-logs/export?\${params}\`, {
  headers: {
    'X-API-Key': 'mk_live_xxxxxxxxxxxxxxxxxxxx'
  }
});

const csvData = await response.text();
// Save or process CSV data`}
                    </pre>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Error Handling</h3>
                    <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto text-sm">
{`// All errors follow a consistent format
{
  "message": "Validation failed",
  "errors": [
    {
      "path": ["checkInDate"],
      "message": "Check-in date is required"
    }
  ]
}

// Handle errors in your code
try {
  const response = await fetch('/api/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.message);
    
    if (error.errors) {
      error.errors.forEach(e => {
        console.error(\`  - \${e.path.join('.')}: \${e.message}\`);
      });
    }
  }
} catch (e) {
  console.error('Network error:', e);
}`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rate Limiting</CardTitle>
                  <CardDescription>
                    Understanding API rate limits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <h4 className="font-semibold mb-2">Rate Limit Headers</h4>
                      <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                        <li><code>X-RateLimit-Limit</code>: Max requests per hour</li>
                        <li><code>X-RateLimit-Remaining</code>: Requests remaining</li>
                        <li><code>X-RateLimit-Reset</code>: Reset timestamp</li>
                      </ul>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      <h4 className="font-semibold mb-2">Rate Limits by Plan</h4>
                      <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                        <li>Standard: 1,000 requests/hour</li>
                        <li>Professional: 5,000 requests/hour</li>
                        <li>Enterprise: Custom limits</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
