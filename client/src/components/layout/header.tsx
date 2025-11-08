import { Button } from "@/components/ui/button";
import { Bell, Plus, Truck } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onNewSale?: () => void;
  onAddDelivery?: () => void;
}

export function Header({ title, subtitle, onNewSale, onAddDelivery }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="page-title">{title}</h2>
          {subtitle && (
            <p className="text-muted-foreground" data-testid="page-subtitle">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {onNewSale && (
            <Button 
              onClick={onNewSale}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-new-sale"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Sale
            </Button>
          )}
          {onAddDelivery && (
            <Button 
              onClick={onAddDelivery}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              data-testid="button-add-delivery"
            >
              <Truck className="w-4 h-4 mr-2" />
              Add Delivery
            </Button>
          )}
          <Button variant="ghost" size="sm" data-testid="button-notifications">
            <div className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-xs"></span>
            </div>
          </Button>
        </div>
      </div>
    </header>
  );
}
