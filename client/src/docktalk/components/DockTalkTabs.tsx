import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Handshake, Bookmark, Newspaper } from "lucide-react";
import AllArticlesPage from "../pages/all-articles";
import MarketIntelligencePage from "../pages/market-intelligence";
import DealsPage from "../pages/deals";
import SavedArticlesPage from "../pages/saved";

export default function DockTalkTabs() {
  return (
    <Tabs defaultValue="all-articles" className="w-full">
      <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
        <TabsTrigger 
          value="all-articles" 
          className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
          data-testid="tab-all-articles"
        >
          <Newspaper className="w-4 h-4" />
          <span>All Articles</span>
        </TabsTrigger>
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

      <TabsContent value="all-articles" className="mt-0">
        <AllArticlesPage />
      </TabsContent>

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
