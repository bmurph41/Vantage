import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MobileTabNavProps {
  tabs: { value: string; label: string }[];
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function MobileTabNav({ tabs, activeTab, onTabChange }: MobileTabNavProps) {
  return (
    <>
      {/* Desktop: horizontal tabs */}
      <div className="hidden md:block">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {/* Mobile: dropdown */}
      <div className="md:hidden">
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.value} value={tab.value}>
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
