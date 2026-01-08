import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Mail, Send, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { EmailSequence, EmailTemplate, EmailSequenceEnrollment } from "@shared/schema";
import { SequenceList } from "@/components/marketing/sequence-list";
import { TemplateList } from "@/components/marketing/template-list";
import { EnrollmentList } from "@/components/marketing/enrollment-list";
import { SequenceFormModal } from "@/components/marketing/sequence-form-modal";
import { TemplateFormModal } from "@/components/marketing/template-form-modal";

export default function MarketingAutomation() {
  const [sequenceModalOpen, setSequenceModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Fetch sequences
  const { data: sequences = [], isLoading: sequencesLoading } = useQuery<EmailSequence[]>({
    queryKey: ["/api/email-sequences"],
  });

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  // Fetch all enrollments for stats
  const { data: allEnrollments = [] } = useQuery<EmailSequenceEnrollment[]>({
    queryKey: ["/api/email-sequence-enrollments"],
  });

  // Calculate stats
  const activeSequences = sequences.filter(s => s.status === "active").length;
  const totalTemplates = templates.length;
  const totalEnrollments = allEnrollments.length;

  const handleEditSequence = (sequence: EmailSequence) => {
    setEditingSequence(sequence);
    setSequenceModalOpen(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateModalOpen(true);
  };

  const handleCloseSequenceModal = () => {
    setSequenceModalOpen(false);
    setEditingSequence(null);
  };

  const handleCloseTemplateModal = () => {
    setTemplateModalOpen(false);
    setEditingTemplate(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats Cards */}
      <div className="p-6 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-sequences">{activeSequences}</div>
              <p className="text-xs text-muted-foreground">Currently running</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sequences</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-sequences">{sequences.length}</div>
              <p className="text-xs text-muted-foreground">All sequences</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Email Templates</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-templates">{totalTemplates}</div>
              <p className="text-xs text-muted-foreground">Reusable templates</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enrollments</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-enrollments">{totalEnrollments}</div>
              <p className="text-xs text-muted-foreground">Total enrollments</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content with Tabs */}
      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="sequences" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="sequences" data-testid="tab-sequences">
                <Send className="h-4 w-4 mr-2" />
                Sequences
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <Mail className="h-4 w-4 mr-2" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="enrollments" data-testid="tab-enrollments">
                <Users className="h-4 w-4 mr-2" />
                Enrollments
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sequences" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Sequences</CardTitle>
                    <CardDescription>
                      Create multi-step drip campaigns to nurture leads and contacts
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setSequenceModalOpen(true)}
                    data-testid="button-create-sequence"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Sequence
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <SequenceList
                  sequences={sequences}
                  isLoading={sequencesLoading}
                  onEdit={handleEditSequence}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>
                      Create reusable email templates for your sequences
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setTemplateModalOpen(true)}
                    data-testid="button-create-template"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <TemplateList
                  templates={templates}
                  isLoading={templatesLoading}
                  onEdit={handleEditTemplate}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollments" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Sequence Enrollments</CardTitle>
                <CardDescription>
                  View and manage contacts enrolled in email sequences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EnrollmentList />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <SequenceFormModal
        open={sequenceModalOpen}
        onClose={handleCloseSequenceModal}
        sequence={editingSequence}
      />
      <TemplateFormModal
        open={templateModalOpen}
        onClose={handleCloseTemplateModal}
        template={editingTemplate}
      />
    </div>
  );
}
