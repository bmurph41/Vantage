import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { MessageSquare, Mail, Smartphone, Send, Plus, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Communication, Customer } from "@shared/schema";

interface CommunicationWithCustomer extends Communication {
  customerName: string;
}

export default function Communications() {
  const [isComposingNew, setIsComposingNew] = useState(false);
  const [newMessage, setNewMessage] = useState({
    type: 'email' as 'email' | 'sms',
    recipient: '',
    subject: '',
    message: '',
  });

  const { toast } = useToast();

  const { data: communications = [], isLoading: communicationsLoading } = useQuery<Communication[]>({
    queryKey: ['/api/communications'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const sendCommunicationMutation = useMutation({
    mutationFn: async (data: {
      customerId: string;
      type: string;
      subject?: string;
      message: string;
    }) => {
      return apiRequest('POST', '/api/communications', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully.",
      });
      setIsComposingNew(false);
      setNewMessage({ type: 'email', recipient: '', subject: '', message: '' });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendBulkReminderMutation = useMutation({
    mutationFn: async () => {
      // This would send payment reminders to all customers with overdue payments
      const overdueCustomers = customers.filter(customer => {
        // In a real implementation, this would check for overdue payments
        return Math.random() > 0.7; // Simulate some customers having overdue payments
      });

      const promises = overdueCustomers.map(customer => 
        apiRequest('POST', '/api/communications', {
          customerId: customer.id,
          type: 'email',
          subject: 'Payment Reminder - Marina Services',
          message: `Dear ${customer.firstName},\n\nThis is a friendly reminder that your marina payment is overdue. Please contact us to settle your account.\n\nThank you,\nMarina Management`,
        })
      );

      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communications'] });
      toast({
        title: "Reminders Sent",
        description: "Payment reminders have been sent to all overdue customers.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send bulk reminders. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Enrich communications with customer details
  const enrichedCommunications: CommunicationWithCustomer[] = communications.map(comm => {
    const customer = customers.find(c => c.id === comm.customerId);
    return {
      ...comm,
      customerName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown Customer',
    };
  }).sort((a, b) => new Date(b.scheduledFor || b.sentAt || '').getTime() - new Date(a.scheduledFor || a.sentAt || '').getTime());

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-accent text-accent-foreground">Sent</Badge>;
      case 'delivered':
        return <Badge className="bg-chart-3 text-white">Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail size={16} />;
      case 'sms':
        return <Smartphone size={16} />;
      default:
        return <MessageSquare size={16} />;
    }
  };

  const handleSendMessage = () => {
    if (!newMessage.recipient || !newMessage.message) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    sendCommunicationMutation.mutate({
      customerId: newMessage.recipient,
      type: newMessage.type,
      subject: newMessage.type === 'email' ? newMessage.subject : undefined,
      message: newMessage.message,
    });
  };

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  // Calculate communication statistics
  const stats = {
    totalSent: communications.filter(c => c.status === 'sent' || c.status === 'delivered').length,
    pending: communications.filter(c => c.status === 'pending').length,
    failed: communications.filter(c => c.status === 'failed').length,
    deliveryRate: communications.length > 0 
      ? Math.round((communications.filter(c => c.status === 'delivered').length / communications.length) * 100)
      : 0,
  };

  if (communicationsLoading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-64" />
              <div className="grid gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Customer Communications</h1>
              <p className="text-muted-foreground">Send notifications, payment reminders, and announcements</p>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => sendBulkReminderMutation.mutate()}
                disabled={sendBulkReminderMutation.isPending}
                data-testid="button-send-bulk-reminders"
              >
                <Users size={16} className="mr-2" />
                {sendBulkReminderMutation.isPending ? "Sending..." : "Send Payment Reminders"}
              </Button>
              <Button onClick={() => setIsComposingNew(true)} data-testid="button-compose-message">
                <Plus size={16} className="mr-2" />
                Compose Message
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card data-testid="messages-sent">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-1 rounded-lg flex items-center justify-center">
                    <Send className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Messages Sent</p>
                    <p className="text-2xl font-bold">{stats.totalSent}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="pending-messages">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-chart-4 rounded-lg flex items-center justify-center">
                    <MessageSquare className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="failed-messages">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-destructive rounded-lg flex items-center justify-center">
                    <Mail className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    <p className="text-2xl font-bold">{stats.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="delivery-rate">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <Smartphone className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivery Rate</p>
                    <p className="text-2xl font-bold">{stats.deliveryRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isComposingNew && (
            <Card data-testid="compose-message">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Compose New Message</h3>
                  <Button variant="ghost" onClick={() => setIsComposingNew(false)}>
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Message Type</Label>
                    <Select value={newMessage.type} onValueChange={(value: 'email' | 'sms') => setNewMessage({...newMessage, type: value})}>
                      <SelectTrigger data-testid="select-message-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Recipient</Label>
                    <Select value={newMessage.recipient} onValueChange={(value) => setNewMessage({...newMessage, recipient: value})}>
                      <SelectTrigger data-testid="select-recipient">
                        <SelectValue placeholder="Select customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.firstName} {customer.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newMessage.type === 'email' && (
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      placeholder="Enter email subject"
                      value={newMessage.subject}
                      onChange={(e) => setNewMessage({...newMessage, subject: e.target.value})}
                      data-testid="input-subject"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Enter your message..."
                    value={newMessage.message}
                    onChange={(e) => setNewMessage({...newMessage, message: e.target.value})}
                    rows={6}
                    data-testid="textarea-message"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button 
                    onClick={handleSendMessage}
                    disabled={sendCommunicationMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send size={16} className="mr-2" />
                    {sendCommunicationMutation.isPending ? "Sending..." : "Send Message"}
                  </Button>
                  <Button variant="outline" onClick={() => setIsComposingNew(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Communication History</h3>
            </CardHeader>
            
            <CardContent>
              {enrichedCommunications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No communications sent yet</p>
                  <p>Click "Compose Message" to send your first communication</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrichedCommunications.map((communication) => (
                    <div
                      key={communication.id}
                      className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                      data-testid={`communication-${communication.id}`}
                    >
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mt-1">
                          {getTypeIcon(communication.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-medium">{communication.customerName}</p>
                            {getStatusBadge(communication.status)}
                          </div>
                          {communication.subject && (
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                              {communication.subject}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {communication.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {communication.sentAt 
                              ? `Sent ${formatDateTime(communication.sentAt.toString())}`
                              : communication.scheduledFor 
                              ? `Scheduled for ${formatDateTime(communication.scheduledFor.toString())}`
                              : 'Not scheduled'
                            }
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="capitalize">
                          {communication.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
