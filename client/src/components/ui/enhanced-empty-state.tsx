import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Upload, 
  Search, 
  Sparkles, 
  ArrowRight,
  LucideIcon
} from "lucide-react";

interface QuickAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "ghost";
}

interface EnhancedEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  primaryAction?: QuickAction;
  secondaryActions?: QuickAction[];
  tips?: string[];
  className?: string;
  variant?: "default" | "minimal" | "illustration";
}

export function EnhancedEmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryActions = [],
  tips = [],
  className,
  variant = "default",
}: EnhancedEmptyStateProps) {
  return (
    <Card className={cn(
      "border-dashed",
      variant === "minimal" && "border-0 shadow-none bg-transparent",
      className
    )}>
      <CardContent className={cn(
        "flex flex-col items-center justify-center text-center",
        variant === "default" && "py-12 px-8",
        variant === "minimal" && "py-8 px-4",
        variant === "illustration" && "py-16 px-12"
      )}>
        <div className={cn(
          "rounded-full flex items-center justify-center mb-4",
          variant === "default" && "w-16 h-16 bg-muted",
          variant === "minimal" && "w-12 h-12 bg-muted/50",
          variant === "illustration" && "w-20 h-20 bg-[#1E4FAB]/10"
        )}>
          <Icon className={cn(
            "text-muted-foreground",
            variant === "default" && "h-8 w-8",
            variant === "minimal" && "h-6 w-6",
            variant === "illustration" && "h-10 w-10 text-[#1E4FAB]"
          )} />
        </div>

        <h3 className={cn(
          "font-semibold",
          variant === "default" && "text-lg",
          variant === "minimal" && "text-base",
          variant === "illustration" && "text-xl"
        )}>
          {title}
        </h3>
        
        <p className={cn(
          "text-muted-foreground mt-2 max-w-sm",
          variant === "default" && "text-sm",
          variant === "minimal" && "text-xs",
          variant === "illustration" && "text-base"
        )}>
          {description}
        </p>

        {(primaryAction || secondaryActions.length > 0) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {primaryAction && (
              primaryAction.href ? (
                <Link href={primaryAction.href}>
                  <Button 
                    className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                    onClick={primaryAction.onClick}
                  >
                    {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-2" />}
                    {primaryAction.label}
                  </Button>
                </Link>
              ) : (
                <Button 
                  className="bg-[#1E4FAB] hover:bg-[#1a4294]"
                  onClick={primaryAction.onClick}
                >
                  {primaryAction.icon && <primaryAction.icon className="h-4 w-4 mr-2" />}
                  {primaryAction.label}
                </Button>
              )
            )}
            
            {secondaryActions.map((action, index) => (
              action.href ? (
                <Link key={index} href={action.href}>
                  <Button 
                    variant={action.variant || "outline"}
                    onClick={action.onClick}
                  >
                    {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button 
                  key={index}
                  variant={action.variant || "outline"}
                  onClick={action.onClick}
                >
                  {action.icon && <action.icon className="h-4 w-4 mr-2" />}
                  {action.label}
                </Button>
              )
            ))}
          </div>
        )}

        {tips.length > 0 && (
          <div className="mt-8 pt-6 border-t w-full max-w-md">
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground mb-3">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">Quick Tips</span>
            </div>
            <ul className="space-y-2 text-left">
              {tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#1E4FAB]" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CRMEmptyState({ onCreateDeal }: { onCreateDeal?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={Search}
      title="No deals yet"
      description="Start tracking your marina acquisition pipeline by adding your first deal."
      variant="illustration"
      primaryAction={{
        label: "Add First Deal",
        icon: Plus,
        onClick: onCreateDeal,
      }}
      secondaryActions={[
        { label: "Import Deals", icon: Upload, href: "/crm/import" },
      ]}
      tips={[
        "Deals flow through your pipeline from Lead to Closed",
        "Link deals to modeling projects for valuation tracking",
        "Add contacts and companies to build your network",
      ]}
    />
  );
}

export function DDEmptyState({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={Search}
      title="No due diligence projects"
      description="Create a DD project to start tracking tasks and documents for an acquisition."
      variant="illustration"
      primaryAction={{
        label: "Create DD Project",
        icon: Plus,
        onClick: onCreateProject,
      }}
      tips={[
        "Use templates to quickly set up common DD checklists",
        "Track task completion by category (Financial, Legal, Environmental)",
        "Link DD projects to CRM deals and modeling projects",
      ]}
    />
  );
}

export function ModelingEmptyState({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <EnhancedEmptyState
      icon={Search}
      title="No modeling projects"
      description="Create your first valuation model to analyze a marina acquisition opportunity."
      variant="illustration"
      primaryAction={{
        label: "Create Project",
        icon: Plus,
        onClick: onCreateProject,
      }}
      secondaryActions={[
        { label: "Use Template", icon: Sparkles, href: "/modeling/templates" },
      ]}
      tips={[
        "Upload P&L documents for AI-powered data extraction",
        "Run multi-case scenario analysis (Base, Conservative, Aggressive)",
        "Generate professional offering memorandums with one click",
      ]}
    />
  );
}

export function OperationsEmptyState({ moduleName }: { moduleName: string }) {
  return (
    <EnhancedEmptyState
      icon={Search}
      title={`No ${moduleName} data yet`}
      description={`Connect an integration or add data manually to start tracking ${moduleName.toLowerCase()}.`}
      variant="default"
      primaryAction={{
        label: "Connect Integration",
        icon: Plus,
        href: "/settings/integrations",
      }}
      tips={[
        "Connected integrations sync data automatically",
        "Live data flows to your valuation models for owned marinas",
        "View historical trends and performance metrics",
      ]}
    />
  );
}
