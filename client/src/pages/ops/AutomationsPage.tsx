import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Clock, 
  CheckCircle, 
  XCircle,
  Settings,
  History
} from "lucide-react";
import { RuleBuilder } from "@/components/ops/automations/RuleBuilder";
import { apiRequest } from "@/lib/queryClient";

export default function AutomationsPage() {
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["/api/opssos/automations/rules"],
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ["/api/opssos/automations/runs"],
  });

  const { data: scheduledJobs } = useQuery({
    queryKey: ["/api/opssos/automations/scheduled"],
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest(`/api/opssos/automations/rules/${ruleId}/toggle`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opssos/automations/rules"] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-sm text-muted-foreground">
            Create rules to automate tasks and messages
          </p>
        </div>
        <Button onClick={() => { setSelectedRule(null); setShowRuleBuilder(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {rules?.filter((r: any) => r.enabled).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Runs Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {runs?.filter((r: any) => {
                const today = new Date().toDateString();
                return new Date(r.startedAt).toDateString() === today;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {scheduledJobs?.filter((j: any) => j.status === "queued").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {rulesLoading ? (
            <div className="text-center py-8">Loading rules...</div>
          ) : rules?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No automation rules yet</p>
                <Button className="mt-4" onClick={() => setShowRuleBuilder(true)}>
                  Create your first rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules?.map((rule: any) => (
                <Card key={rule.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRuleMutation.mutate(rule.id)}
                        />
                        <div>
                          <h3 className="font-medium">{rule.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Trigger: {rule.triggerType}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.enabled ? "default" : "secondary"}>
                          {rule.enabled ? "Active" : "Paused"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedRule(rule); setShowRuleBuilder(true); }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {runsLoading ? (
            <div className="text-center py-8">Loading run history...</div>
          ) : runs?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No automation runs yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {runs?.slice(0, 50).map((run: any) => (
                <Card key={run.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {run.status === "completed" ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : run.status === "failed" ? (
                          <XCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">Rule #{run.ruleId}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(run.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                        {run.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          {scheduledJobs?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No scheduled jobs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {scheduledJobs?.map((job: any) => (
                <Card key={job.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{job.type}</p>
                        <p className="text-xs text-muted-foreground">
                          Scheduled for: {new Date(job.runAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant={job.status === "queued" ? "secondary" : job.status === "done" ? "default" : "destructive"}>
                        {job.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showRuleBuilder && (
        <RuleBuilder
          rule={selectedRule}
          onClose={() => setShowRuleBuilder(false)}
          onSave={() => {
            setShowRuleBuilder(false);
            queryClient.invalidateQueries({ queryKey: ["/api/opssos/automations/rules"] });
          }}
        />
      )}
    </div>
  );
}
