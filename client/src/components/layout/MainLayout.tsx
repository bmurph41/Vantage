import { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {(title || subtitle) && (
        <div className="border-b bg-card">
          <div className="container py-6">
            {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
      )}
      <div className="container py-6">
        {children}
      </div>
    </div>
  );
}
