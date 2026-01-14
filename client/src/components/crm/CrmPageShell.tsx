import { cn } from "@/lib/utils";

interface CrmPageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function CrmPageShell({ children, className }: CrmPageShellProps) {
  return (
    <div className={cn("flex flex-col h-full bg-gray-50/50", className)}>
      {children}
    </div>
  );
}
