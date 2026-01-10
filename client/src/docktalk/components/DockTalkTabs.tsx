import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Handshake, Bookmark, Newspaper, Mail, Eye } from "lucide-react";
import { Link } from "wouter";
import AllArticlesPage from "../pages/all-articles";
import MarketIntelligencePage from "../pages/market-intelligence";
import DealsPage from "../pages/deals";
import SavedArticlesPage from "../pages/saved";
import WatchlistPage from "../pages/portfolio";
import SavedSearchesPage from "../pages/saved-searches";

interface DockTalkTabsProps {
  activeTab: string;
}

export default function DockTalkTabs({ activeTab }: DockTalkTabsProps) {
  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="w-full justify-start border-b border-gray-200 dark:border-gray-800 rounded-none h-auto p-0 bg-white dark:bg-gray-900">
        <Link href="/docktalk">
          <TabsTrigger 
            value="all-articles" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-all-articles"
          >
            <Newspaper className="w-4 h-4" />
            <span>All Articles</span>
          </TabsTrigger>
        </Link>
        <Link href="/docktalk/market-intelligence">
          <TabsTrigger 
            value="market-intelligence" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-market-intelligence"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Market Intelligence</span>
          </TabsTrigger>
        </Link>
        <Link href="/docktalk/m&a-spotlight">
          <TabsTrigger 
            value="m&a-spotlight" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-m&a-spotlight"
          >
            <Handshake className="w-4 h-4" />
            <span>M&A Spotlight</span>
          </TabsTrigger>
        </Link>
        <Link href="/docktalk/saved">
          <TabsTrigger 
            value="saved" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-saved"
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved Articles</span>
          </TabsTrigger>
        </Link>
        <Link href="/docktalk/watchlist">
          <TabsTrigger 
            value="watchlist" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-watchlist"
          >
            <Eye className="w-4 h-4" />
            <span>Watchlist</span>
          </TabsTrigger>
        </Link>
        <Link href="/docktalk/email-alerts">
          <TabsTrigger 
            value="email-alerts" 
            className="flex items-center gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent px-6 py-3"
            data-testid="tab-email-alerts"
          >
            <Mail className="w-4 h-4" />
            <span>Email Alerts</span>
          </TabsTrigger>
        </Link>
      </TabsList>

      <TabsContent value="all-articles" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <AllArticlesPage />
      </TabsContent>

      <TabsContent value="market-intelligence" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <MarketIntelligencePage />
      </TabsContent>

      <TabsContent value="m&a-spotlight" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <DealsPage />
      </TabsContent>

      <TabsContent value="saved" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <SavedArticlesPage />
      </TabsContent>

      <TabsContent value="watchlist" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <WatchlistPage />
      </TabsContent>

      <TabsContent value="email-alerts" className="mt-0 h-[calc(100vh-140px)] overflow-auto">
        <SavedSearchesPage />
      </TabsContent>
    </Tabs>
  );
}
