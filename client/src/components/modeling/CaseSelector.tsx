import { useState } from 'react';
import { useModelingCases, getCaseColorClasses, CASE_COLORS, ModelingCase } from '@/hooks/useModelingCases';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ChevronDown, 
  Plus, 
  Copy, 
  Star, 
  Trash2, 
  Loader2,
  Layers
} from 'lucide-react';

interface CaseSelectorProps {
  projectId: string;
  selectedCaseId?: string;
  onCaseChange: (caseId: string) => void;
  compact?: boolean;
}

export function CaseSelector({ 
  projectId, 
  selectedCaseId, 
  onCaseChange,
  compact = false 
}: CaseSelectorProps) {
  const { 
    cases, 
    isLoading, 
    defaultCase,
    createCase, 
    deleteCase, 
    setDefault, 
    cloneCase,
    isPending 
  } = useModelingCases(projectId);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseDescription, setNewCaseDescription] = useState('');
  const [newCaseColor, setNewCaseColor] = useState('blue');

  const selectedCase = cases.find(c => c.id === selectedCaseId) || defaultCase;
  const colorClasses = selectedCase ? getCaseColorClasses(selectedCase.color) : getCaseColorClasses('blue');

  const handleCreateCase = async () => {
    if (!newCaseName.trim()) return;
    await createCase({ name: newCaseName, description: newCaseDescription, color: newCaseColor });
    setShowCreateDialog(false);
    setNewCaseName('');
    setNewCaseDescription('');
    setNewCaseColor('blue');
  };

  const handleCloneCase = async () => {
    if (!cloneSourceId || !newCaseName.trim()) return;
    const result = await cloneCase({ caseId: cloneSourceId, name: newCaseName, description: newCaseDescription });
    if (result?.id) {
      onCaseChange(result.id);
    }
    setShowCloneDialog(false);
    setCloneSourceId(null);
    setNewCaseName('');
    setNewCaseDescription('');
  };

  const handleDeleteCase = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this case? This cannot be undone.')) {
      await deleteCase(caseId);
      if (selectedCaseId === caseId && defaultCase) {
        onCaseChange(defaultCase.id);
      }
    }
  };

  const handleSetDefault = async (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await setDefault(caseId);
  };

  const handleCloneClick = (caseId: string, caseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCloneSourceId(caseId);
    setNewCaseName(`${caseName} (Copy)`);
    setShowCloneDialog(true);
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled className={compact ? 'h-8' : ''}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (cases.length === 0) {
    return (
      <Button 
        variant="outline" 
        onClick={() => setShowCreateDialog(true)}
        className={compact ? 'h-8' : ''}
        data-testid="button-create-first-case"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Case
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className={`${compact ? 'h-8 px-2' : ''} min-w-[140px] justify-between`}
            data-testid="button-case-selector"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${colorClasses.dot}`} />
              <span className="truncate max-w-[120px]">{selectedCase?.name || 'Select Case'}</span>
              {selectedCase?.isDefault && (
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              )}
            </div>
            <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {cases.map((c) => {
            const cColors = getCaseColorClasses(c.color);
            return (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onCaseChange(c.id)}
                className="flex items-center justify-between py-2"
                data-testid={`menu-item-case-${c.id}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${cColors.dot}`} />
                  <span className="truncate">{c.name}</span>
                  {c.isDefault && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleCloneClick(c.id, c.name, e)}
                    title="Clone case"
                    data-testid={`button-clone-case-${c.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {!c.isDefault && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => handleSetDefault(c.id, e)}
                        title="Set as default"
                        data-testid={`button-set-default-${c.id}`}
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={(e) => handleDeleteCase(c.id, e)}
                        title="Delete case"
                        data-testid={`button-delete-case-${c.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowCreateDialog(true)}
            data-testid="menu-item-create-case"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Case
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Create New Case
            </DialogTitle>
            <DialogDescription>
              Add a new scenario case with its own assumptions and projections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="case-name">Case Name</Label>
              <Input
                id="case-name"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="e.g., Aggressive Growth, Conservative, etc."
                data-testid="input-case-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="case-description">Description (optional)</Label>
              <Textarea
                id="case-description"
                value={newCaseDescription}
                onChange={(e) => setNewCaseDescription(e.target.value)}
                placeholder="Describe the assumptions for this case..."
                rows={3}
                data-testid="input-case-description"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {CASE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewCaseColor(color.value)}
                    className={`w-8 h-8 rounded-full ${color.dot} ${
                      newCaseColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                    }`}
                    title={color.label}
                    data-testid={`button-color-${color.value}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCase} 
              disabled={!newCaseName.trim() || isPending}
              data-testid="button-confirm-create-case"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Clone Case
            </DialogTitle>
            <DialogDescription>
              Create a copy of this case with all its assumptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">New Case Name</Label>
              <Input
                id="clone-name"
                value={newCaseName}
                onChange={(e) => setNewCaseName(e.target.value)}
                placeholder="Enter a name for the cloned case"
                data-testid="input-clone-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-description">Description (optional)</Label>
              <Textarea
                id="clone-description"
                value={newCaseDescription}
                onChange={(e) => setNewCaseDescription(e.target.value)}
                placeholder="Describe what makes this case different..."
                rows={3}
                data-testid="input-clone-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloneDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCloneCase} 
              disabled={!newCaseName.trim() || isPending}
              data-testid="button-confirm-clone-case"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Clone Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
