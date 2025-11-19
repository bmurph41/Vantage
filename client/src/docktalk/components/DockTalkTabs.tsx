import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Handshake, Bookmark } from "lucide-react";
import MarketIntelligencePage from "../pages/market-intelligence";
import DealsPage from "../pages/deals";
import SavedArticlesPage from "../pages/saved";

export default function DockTalkTabs() {
  return (
    <Tabs defaultValue="market-intelligence" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
        <TabsTrigger 
          value="market-intelligence" 
          className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
          data-testid="tab-market-intelligence"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Market Intelligence</span>
        </TabsTrigger>
        <TabsTrigger 
          value="m&a-spotlight" 
          className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
          data-testid="tab-m&a-spotlight"
        >
          <Handshake className="w-4 h-4" />
          <span>M&A Spotlight</span>
        </TabsTrigger>
        <TabsTrigger 
          value="saved" 
          className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
          data-testid="tab-saved"
        >
          <Bookmark className="w-4 h-4" />
          <span>Saved Articles</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="market-intelligence" className="mt-0">
        <MarketIntelligencePage />
      </TabsContent>

      <TabsContent value="m&a-spotlight" className="mt-0">
        <DealsPage />
      </TabsContent>

      <TabsContent value="saved" className="mt-0">
        <SavedArticlesPage />
      </TabsContent>
    </Tabs>
  );
}
