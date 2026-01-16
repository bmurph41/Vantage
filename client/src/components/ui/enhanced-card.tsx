import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Phone, ExternalLink, MoreHorizontal } from "lucide-react";
import type { ReactNode, ComponentProps } from "react";

export function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const avatarColorPalette = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-pink-500",
];

export function getAvatarColor(name: string): string {
  if (!name) return avatarColorPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColorPalette[Math.abs(hash) % avatarColorPalette.length];
}

interface EntityAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

export function EntityAvatar({ name, imageUrl, size = "md", className }: EntityAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);

  return (
    <Avatar className={cn(sizeClasses[size], "ring-2 ring-white dark:ring-gray-800 shadow-sm", className)}>
      {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
      <AvatarFallback className={cn(colorClass, "text-white font-medium")}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "outline" | "soft";
  size?: "sm" | "md";
  className?: string;
}

const statusColorMap: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  available: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  new: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  pending: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  under_contract: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  closed: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700" },
  sold: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-700" },
  off_market: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  hot: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  warm: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  cold: { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
  qualified: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  unqualified: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  contacted: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  converted: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
};

export function StatusBadge({ status, variant = "soft", size = "sm", className }: StatusBadgeProps) {
  const colors = statusColorMap[status] || statusColorMap.pending;
  const displayText = status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium transition-colors",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
        variant === "soft" && cn(colors.bg, colors.text, colors.border),
        variant === "outline" && cn("bg-transparent", colors.text, colors.border),
        className
      )}
    >
      {displayText}
    </Badge>
  );
}

interface RoleBadgeProps {
  role: string;
  customRole?: string | null;
  size?: "sm" | "md";
  className?: string;
}

const roleColorMap: Record<string, { bg: string; text: string }> = {
  seller: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  buyer: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" },
  attorney: { bg: "bg-purple-100 dark:bg-purple-900/40", text: "text-purple-700 dark:text-purple-300" },
  lender: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300" },
  broker: { bg: "bg-pink-100 dark:bg-pink-900/40", text: "text-pink-700 dark:text-pink-300" },
  inspector: { bg: "bg-indigo-100 dark:bg-indigo-900/40", text: "text-indigo-700 dark:text-indigo-300" },
  surveyor: { bg: "bg-cyan-100 dark:bg-cyan-900/40", text: "text-cyan-700 dark:text-cyan-300" },
  appraiser: { bg: "bg-orange-100 dark:bg-orange-900/40", text: "text-orange-700 dark:text-orange-300" },
  environmental: { bg: "bg-teal-100 dark:bg-teal-900/40", text: "text-teal-700 dark:text-teal-300" },
  title_insurance: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  insurance_agent: { bg: "bg-violet-100 dark:bg-violet-900/40", text: "text-violet-700 dark:text-violet-300" },
  lead: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  competitor: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  vendor: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  other: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300" },
};

const roleLabels: Record<string, string> = {
  seller: "Seller",
  buyer: "Buyer",
  attorney: "Attorney",
  lender: "Lender",
  broker: "Broker",
  inspector: "Inspector",
  surveyor: "Surveyor",
  appraiser: "Appraiser",
  environmental: "Environmental",
  title_insurance: "Title Insurance",
  insurance_agent: "Insurance Agent",
  lead: "Lead",
  competitor: "Competitor",
  vendor: "Vendor",
  other: "Other",
};

export function RoleBadge({ role, customRole, size = "sm", className }: RoleBadgeProps) {
  const colors = roleColorMap[role] || roleColorMap.other;
  const displayText = customRole || roleLabels[role] || role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium border-0",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
        colors.bg,
        colors.text,
        className
      )}
    >
      {displayText}
    </Badge>
  );
}

interface QuickActionButtonProps extends ComponentProps<typeof Button> {
  icon: ReactNode;
  tooltip: string;
}

export function QuickActionButton({ icon, tooltip, className, ...props }: QuickActionButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full hover:bg-muted/80 transition-all duration-200",
              "hover:scale-105 active:scale-95",
              className
            )}
            {...props}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ContactQuickActionsProps {
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  onEmailClick?: () => void;
  onPhoneClick?: () => void;
  onMoreClick?: () => void;
  className?: string;
}

export function ContactQuickActions({ 
  email, 
  phone, 
  website, 
  onEmailClick, 
  onPhoneClick, 
  onMoreClick,
  className 
}: ContactQuickActionsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {email && (
        <QuickActionButton
          icon={<Mail className="h-4 w-4" />}
          tooltip={`Email ${email}`}
          onClick={onEmailClick || (() => window.open(`mailto:${email}`))}
        />
      )}
      {phone && (
        <QuickActionButton
          icon={<Phone className="h-4 w-4" />}
          tooltip={`Call ${phone}`}
          onClick={onPhoneClick || (() => window.open(`tel:${phone}`))}
        />
      )}
      {website && (
        <QuickActionButton
          icon={<ExternalLink className="h-4 w-4" />}
          tooltip="Visit website"
          onClick={() => window.open(website.startsWith('http') ? website : `https://${website}`, '_blank')}
        />
      )}
      {onMoreClick && (
        <QuickActionButton
          icon={<MoreHorizontal className="h-4 w-4" />}
          tooltip="More actions"
          onClick={onMoreClick}
        />
      )}
    </div>
  );
}

interface EnhancedCardContainerProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  accentColor?: string;
  isHoverable?: boolean;
}

export function EnhancedCardContainer({ 
  children, 
  onClick, 
  className, 
  accentColor,
  isHoverable = true 
}: EnhancedCardContainerProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative bg-card rounded-xl border shadow-sm overflow-hidden",
        "transition-all duration-200 ease-out",
        isHoverable && "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
        onClick && "cursor-pointer",
        className
      )}
    >
      {accentColor && (
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentColor)} />
      )}
      {children}
    </div>
  );
}

interface EnhancedCardHeaderProps {
  avatar?: ReactNode;
  title: string;
  subtitle?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function EnhancedCardHeader({ 
  avatar, 
  title, 
  subtitle, 
  badges, 
  actions,
  className 
}: EnhancedCardHeaderProps) {
  return (
    <div className={cn("flex items-start gap-3 p-4", className)}>
      {avatar}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate leading-tight">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
        {badges && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {badges}
          </div>
        )}
      </div>
    </div>
  );
}

interface EnhancedCardBodyProps {
  children: ReactNode;
  className?: string;
}

export function EnhancedCardBody({ children, className }: EnhancedCardBodyProps) {
  return (
    <div className={cn("px-4 pb-3 space-y-2", className)}>
      {children}
    </div>
  );
}

interface EnhancedCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function EnhancedCardFooter({ children, className }: EnhancedCardFooterProps) {
  return (
    <div className={cn(
      "px-4 py-3 border-t bg-muted/30 flex items-center justify-between gap-2",
      className
    )}>
      {children}
    </div>
  );
}

interface InfoRowProps {
  icon: ReactNode;
  label?: string;
  value: string | ReactNode;
  className?: string;
}

export function InfoRow({ icon, label, value, className }: InfoRowProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground shrink-0">{icon}</span>
      {label && <span className="text-muted-foreground">{label}:</span>}
      <span className="text-foreground truncate">{value}</span>
    </div>
  );
}

interface CountBadgeProps {
  count: number;
  label: string;
  icon?: ReactNode;
  className?: string;
}

export function CountBadge({ count, label, icon, className }: CountBadgeProps) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-xs text-muted-foreground",
      className
    )}>
      {icon}
      <span className="font-medium text-foreground">{count}</span>
      <span>{label}</span>
    </div>
  );
}

export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === "1") {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function formatCurrencyCompact(amount: number | string | null | undefined): string {
  if (!amount) return "$0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0";
  
  if (num >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `$${(num / 1_000).toFixed(0)}K`;
  }
  return `$${num.toFixed(0)}`;
}
