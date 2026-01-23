import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, HelpCircle, CheckCircle2, ArrowLeft, Loader2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { IntegrationItem, SettingsField } from "@/lib/api/integrations";

interface IntegrationSetupWizardProps {
  integration: IntegrationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (credentials: Record<string, string>) => void;
  isConnecting?: boolean;
}

export function IntegrationSetupWizard({
  integration,
  open,
  onOpenChange,
  onConnect,
  isConnecting,
}: IntegrationSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));

  if (!integration) return null;

  const credentialFields = getCredentialFields(integration);
  const guideSteps = integration.connectionGuide?.steps || getDefaultSteps(integration);
  const totalSteps = 2;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const canProceed = credentialFields.every(
    (field) => !field.required || (credentials[field.key]?.trim())
  );

  const handleNext = () => {
    if (currentStep === 0) {
      setCurrentStep(1);
    } else {
      onConnect(credentials);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setCredentials({});
    setExpandedSteps(new Set([0]));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[520px]">
          <div className="flex-1 p-6">
            <DialogHeader className="mb-6">
              <div className="flex items-center gap-3">
                <ArrowLeft 
                  className="w-5 h-5 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" 
                  onClick={handleBack}
                />
                <DialogTitle className="text-xl">
                  Connect with {integration.name}
                </DialogTitle>
              </div>
            </DialogHeader>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Step {currentStep + 1} of {totalSteps}</span>
                <span>{Math.round(progressPercent)}% complete</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>

            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-1">Enter your {integration.name} credentials</h3>
                  <p className="text-sm text-muted-foreground">
                    {integration.connectionGuide?.overview || 
                      `MarinaMatch syncs ${integration.name} data securely.`}
                  </p>
                </div>

                <div className="space-y-4">
                  {credentialFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </Label>
                      <Input
                        id={field.key}
                        type={field.type === "secret" ? "password" : "text"}
                        placeholder={field.label}
                        value={credentials[field.key] || ""}
                        onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                        className="h-11"
                      />
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  {guideSteps.map((step, idx) => (
                    <Collapsible
                      key={idx}
                      open={expandedSteps.has(idx)}
                      onOpenChange={() => toggleStep(idx)}
                    >
                      <CollapsibleTrigger className="flex items-center gap-3 w-full text-left py-3 px-4 rounded-lg border hover:bg-muted/50 transition-colors">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E4FAB] text-white text-sm flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium">{step.title}</span>
                        {expandedSteps.has(idx) ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-4 pb-3">
                        <div className="pl-9 pt-2">
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                          {step.screenshot && (
                            <img 
                              src={step.screenshot} 
                              alt={step.title}
                              className="mt-3 rounded-lg border max-w-full"
                            />
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-1">Confirm Connection</h3>
                  <p className="text-sm text-muted-foreground">
                    Review your settings and connect to {integration.name}.
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Ready to connect
                  </h4>
                  <div className="space-y-2">
                    {credentialFields.map((field) => (
                      <div key={field.key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{field.label}:</span>
                        <span className="font-mono">
                          {field.type === "secret" 
                            ? "••••••••" + (credentials[field.key]?.slice(-4) || "")
                            : credentials[field.key] || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm text-blue-900">What happens next?</h4>
                      <ul className="mt-2 space-y-1 text-sm text-blue-800">
                        <li>• Your credentials will be securely encrypted</li>
                        <li>• We'll verify the connection to {integration.name}</li>
                        <li>• Data sync will begin automatically</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 mt-6 border-t">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={currentStep === 0 ? !canProceed : isConnecting}
                className="bg-[#1E4FAB] hover:bg-[#1a4294] min-w-[120px]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : currentStep === totalSteps - 1 ? (
                  "Connect"
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </div>

          <div className="w-full lg:w-80 bg-slate-50 border-t lg:border-t-0 lg:border-l p-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-5 h-5 text-[#1E4FAB]" />
              <h3 className="font-semibold">Need Help?</h3>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Not sure where to find your credentials? We'll walk you through it.
              </p>

              {integration.connectionGuide?.supportUrl && (
                <a
                  href={integration.connectionGuide.supportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#1E4FAB] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Contact {integration.name} Support
                </a>
              )}

              {integration.connectionGuide?.apiDocsUrl && (
                <a
                  href={integration.connectionGuide.apiDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#1E4FAB] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View API Documentation
                </a>
              )}

              {integration.websiteUrl && (
                <a
                  href={integration.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#1E4FAB] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Visit {integration.name} Website
                </a>
              )}

              <div className="pt-4 border-t">
                <div className="bg-white rounded-lg p-4 border">
                  <div className="flex items-center gap-3 mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1E4FAB] to-[#152d6b] flex items-center justify-center text-white font-semibold text-sm"
                      style={integration.logoColor ? { background: integration.logoColor } : undefined}
                    >
                      {integration.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{integration.name}</p>
                      <p className="text-xs text-muted-foreground">{integration.category}</p>
                    </div>
                  </div>
                  {integration.connectionGuide?.estimatedTime && (
                    <p className="text-xs text-muted-foreground">
                      Estimated setup time: {integration.connectionGuide.estimatedTime}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-4">
                <p className="text-xs text-muted-foreground">
                  Your credentials are stored securely using industry-standard encryption. 
                  MarinaMatch never shares your data with third parties.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getCredentialFields(integration: IntegrationItem): SettingsField[] {
  const schemaFields = integration.settingsSchema?.fields || [];
  
  const credentialTypes = schemaFields.filter(
    (f) => f.type === "secret" || f.key.toLowerCase().includes("key") || f.key.toLowerCase().includes("secret")
  );

  if (credentialTypes.length > 0) {
    return credentialTypes;
  }

  if (integration.authType === "apiKey") {
    return [
      {
        key: "apiKey",
        label: "API Key",
        type: "secret",
        required: true,
        helpText: `Enter your ${integration.name} API key`,
      },
    ];
  }

  return [];
}

function getDefaultSteps(integration: IntegrationItem): Array<{ title: string; description: string }> {
  return [
    {
      title: `Open ${integration.name} in a new tab`,
      description: `Go to ${integration.websiteUrl || integration.name + "'s website"} and log in to your account.`,
    },
    {
      title: "Navigate to Settings > API",
      description: `Look for API settings, Developer options, or Integrations section in your ${integration.name} account settings.`,
    },
    {
      title: "Copy the API Key",
      description: `Find your API key or generate a new one, then copy it to paste in the field above.`,
    },
    {
      title: "Paste in MarinaMatch",
      description: "Return here and paste your API key in the field above to complete the connection.",
    },
  ];
}
