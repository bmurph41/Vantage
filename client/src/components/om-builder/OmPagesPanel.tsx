import { 
  FileText, 
  Plus, 
  Trash2, 
  Copy,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOmEditorStore, type OmPage } from '@/stores/om-editor-store';
import { cn } from '@/lib/utils';

export function OmPagesPanel() {
  const {
    pages,
    currentPageId,
    setCurrentPage,
    addPage,
    deletePage,
    reorderPages,
  } = useOmEditorStore();

  const sortedPages = [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleAddPage = () => {
    const newPage: OmPage = {
      id: `page-${Date.now()}`,
      name: `Page ${pages.length + 1}`,
      order: pages.length,
      pageSize: 'letter',
      orientation: 'portrait',
      width: 612,
      height: 792,
    };
    addPage(newPage);
    setCurrentPage(newPage.id);
  };

  const handleMovePage = (pageId: string, direction: 'up' | 'down') => {
    const currentIndex = sortedPages.findIndex(p => p.id === pageId);
    if (direction === 'up' && currentIndex > 0) {
      const newOrder = [...sortedPages];
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
      reorderPages(newOrder.map(p => p.id));
    } else if (direction === 'down' && currentIndex < sortedPages.length - 1) {
      const newOrder = [...sortedPages];
      [newOrder[currentIndex + 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex + 1]];
      reorderPages(newOrder.map(p => p.id));
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <FileText className="h-4 w-4" />
        <span className="font-medium text-sm">Pages</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-auto"
          onClick={handleAddPage}
          data-testid="btn-add-page"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedPages.map((page, idx) => (
            <div
              key={page.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer group',
                currentPageId === page.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              )}
              onClick={() => setCurrentPage(page.id)}
              data-testid={`page-item-${page.id}`}
            >
              <div className="w-8 h-10 bg-white border rounded flex items-center justify-center text-[10px] text-muted-foreground">
                {idx + 1}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{page.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {page.width} × {page.height}
                </div>
              </div>

              <div className="hidden group-hover:flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMovePage(page.id, 'up');
                  }}
                  disabled={idx === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMovePage(page.id, 'down');
                  }}
                  disabled={idx === sortedPages.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (pages.length > 1) {
                      deletePage(page.id);
                    }
                  }}
                  disabled={pages.length <= 1}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
