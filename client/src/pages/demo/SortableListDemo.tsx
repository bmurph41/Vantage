import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SortableList } from '@/components/dnd/SortableList';
import { SortableKanban } from '@/components/dnd/SortableKanban';
import { Plus, FileText, Star } from 'lucide-react';

// Demo data types
interface DemoItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  sortOrder: number;
}

interface KanbanDemoItem {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  sortOrder: number;
  columnId: string;
}

// Sample data
const initialItems: DemoItem[] = Array.from({ length: 20 }, (_, i) => ({
  id: `item-${i + 1}`,
  title: `Task ${i + 1}: ${['Review documents', 'Complete analysis', 'Update reports', 'Schedule meetings', 'Send notifications', 'Process requests', 'Generate summaries', 'Validate data'][i % 8]}`,
  description: `This is a description for task ${i + 1}. It contains important details about what needs to be accomplished.`,
  priority: ['low', 'medium', 'high'][i % 3] as 'low' | 'medium' | 'high',
  sortOrder: (i + 1) * 10,
}));

const initialKanbanData = {
  'todo': [
    { id: 'k1', title: 'Design mockups', description: 'Create UI/UX designs', priority: 'high' as const, sortOrder: 10, columnId: 'todo' },
    { id: 'k2', title: 'Research competitors', description: 'Analyze market competition', priority: 'medium' as const, sortOrder: 20, columnId: 'todo' },
    { id: 'k3', title: 'Plan project timeline', description: 'Set milestones and deadlines', priority: 'low' as const, sortOrder: 30, columnId: 'todo' },
  ],
  'in-progress': [
    { id: 'k4', title: 'Implement drag & drop', description: 'Add @dnd-kit functionality', priority: 'high' as const, sortOrder: 10, columnId: 'in-progress' },
    { id: 'k5', title: 'Write unit tests', description: 'Test sortable components', priority: 'medium' as const, sortOrder: 20, columnId: 'in-progress' },
  ],
  'done': [
    { id: 'k6', title: 'Setup project structure', description: 'Initialize repository', priority: 'medium' as const, sortOrder: 10, columnId: 'done' },
    { id: 'k7', title: 'Install dependencies', description: 'Add required packages', priority: 'low' as const, sortOrder: 20, columnId: 'done' },
  ],
};

// Item renderer for simple list
function DemoItemRenderer({ item }: { item: DemoItem }) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <h3 className="font-medium text-gray-900">{item.title}</h3>
          </div>
          <Badge 
            variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {item.priority}
          </Badge>
        </div>
        <p className="text-sm text-gray-600 mb-2">{item.description}</p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Sort: {item.sortOrder}</span>
          <span>ID: {item.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Kanban item renderer
function KanbanItemRenderer({ item }: { item: KanbanDemoItem }) {
  return (
    <Card className="w-full shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
            {item.title}
          </h4>
          <div className="flex items-center space-x-1 ml-2">
            {item.priority === 'high' && <Star className="h-3 w-3 text-orange-500" />}
            <Badge 
              variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'default' : 'secondary'}
              className="text-xs px-1.5 py-0.5"
            >
              {item.priority}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">
          {item.description}
        </p>
        <div className="text-xs text-gray-400">
          Sort: {item.sortOrder}
        </div>
      </CardContent>
    </Card>
  );
}

export function SortableListDemo() {
  const [items, setItems] = useState<DemoItem[]>(initialItems);
  const [kanbanItems, setKanbanItems] = useState<Record<string, KanbanDemoItem[]>>(initialKanbanData);
  const [isReordering, setIsReordering] = useState(false);

  // Handle simple list reordering
  const handleReorder = async (updates: Array<{ id: string; sortOrder: number }>) => {
    setIsReordering(true);
    
    // Simulate server delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Apply updates optimistically
    setItems(prevItems => {
      const updatedItems = [...prevItems];
      updates.forEach(update => {
        const itemIndex = updatedItems.findIndex(item => item.id === update.id);
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = { ...updatedItems[itemIndex], sortOrder: update.sortOrder };
        }
      });
      // Re-sort by sortOrder
      return updatedItems.sort((a, b) => a.sortOrder - b.sortOrder);
    });
    
    setIsReordering(false);
  };

  // Handle kanban reordering
  const handleKanbanReorder = async (updates: Array<{ id: string; sortOrder: number; columnId: string }>) => {
    setIsReordering(true);
    
    // Simulate server delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Apply updates optimistically
    setKanbanItems(prevItems => {
      const newItems = { ...prevItems };
      
      // Clear all columns first
      Object.keys(newItems).forEach(columnId => {
        newItems[columnId] = [];
      });
      
      // Re-populate based on updates
      updates.forEach(update => {
        const originalItem = Object.values(prevItems).flat().find(item => item.id === update.id);
        if (originalItem) {
          const updatedItem = { 
            ...originalItem, 
            sortOrder: update.sortOrder, 
            columnId: update.columnId 
          };
          
          if (!newItems[update.columnId]) {
            newItems[update.columnId] = [];
          }
          newItems[update.columnId].push(updatedItem);
        }
      });
      
      // Sort each column by sortOrder
      Object.keys(newItems).forEach(columnId => {
        newItems[columnId].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      
      return newItems;
    });
    
    setIsReordering(false);
  };

  // Add new item
  const addNewItem = () => {
    const newItem: DemoItem = {
      id: `item-${Date.now()}`,
      title: `New Task ${items.length + 1}`,
      description: 'This is a newly added task item.',
      priority: 'medium',
      sortOrder: Math.max(...items.map(i => i.sortOrder)) + 10,
    };
    setItems(prev => [...prev, newItem]);
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl" data-testid="sortable-demo">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Drag & Drop Demo</h1>
        <p className="text-gray-600">
          Interactive examples of the generic SortableList and SortableKanban components with 
          keyboard accessibility, touch support, and server persistence simulation.
        </p>
      </div>

      <Tabs defaultValue="simple-list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2">
          <TabsTrigger value="simple-list">Simple List</TabsTrigger>
          <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
        </TabsList>

        <TabsContent value="simple-list" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sortable Task List</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Drag items by their handles to reorder. Supports mouse, touch, and keyboard navigation.
                  </p>
                </div>
                <Button onClick={addNewItem} size="sm" data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isReordering && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">Saving new order...</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span><strong>Instructions:</strong></span>
                  <span>• Drag the grip handle to reorder</span>
                  <span>• Use Tab + Space/Enter for keyboard navigation</span>
                  <span>• Touch and hold on mobile devices</span>
                </div>
                
                <SortableList
                  items={items}
                  renderItem={(item) => <DemoItemRenderer item={item} />}
                  onReorder={handleReorder}
                  disabled={isReordering}
                  className="space-y-3"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sortable Kanban Board</CardTitle>
              <p className="text-sm text-gray-600">
                Drag items within columns or between columns to reorganize your workflow.
              </p>
            </CardHeader>
            <CardContent>
              {isReordering && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">Saving new order...</p>
                </div>
              )}
              
              <SortableKanban
                columns={[
                  { id: 'todo', title: 'To Do', items: kanbanItems['todo'] || [] },
                  { id: 'in-progress', title: 'In Progress', items: kanbanItems['in-progress'] || [] },
                  { id: 'done', title: 'Done', items: kanbanItems['done'] || [] },
                ]}
                onReorder={handleKanbanReorder}
                renderItem={(item) => <KanbanItemRenderer item={item} />}
                disabled={isReordering}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Technical Details */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Technical Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Accessibility Features</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Keyboard navigation with arrow keys</li>
                <li>• Screen reader support with ARIA labels</li>
                <li>• Focus management and visual indicators</li>
                <li>• Space/Enter to pick up and drop items</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Technical Implementation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• @dnd-kit for robust drag & drop</li>
                <li>• Decimal sort order spacing (10, 20, 30...)</li>
                <li>• Optimistic UI updates with server sync</li>
                <li>• No-overlap layout with CSS Grid/Flex</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SortableListDemo;