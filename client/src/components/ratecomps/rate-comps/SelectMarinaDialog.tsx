import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { formatCurrency } from '@/lib/ratecomps/format';
import type { RateComp } from "@shared/schema";

interface SelectMarinaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableMarinas: RateComp[];
  onSelect: (selectedMarinaIds: string[]) => void;
}

export default function SelectMarinaDialog({
  open,
  onOpenChange,
  availableMarinas,
  onSelect
}: SelectMarinaDialogProps) {
  const [selectedMarinaIds, setSelectedMarinaIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMarinas = availableMarinas.filter(marina =>
    marina.marina.toLowerCase().includes(searchTerm.toLowerCase()) ||
    marina.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    marina.market?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = () => {
    if (selectedMarinaIds.size === filteredMarinas.length) {
      setSelectedMarinaIds(new Set());
    } else {
      setSelectedMarinaIds(new Set(filteredMarinas.map(m => m.id)));
    }
  };

  const handleSelectMarina = (marinaId: string) => {
    const newSelected = new Set(selectedMarinaIds);
    if (newSelected.has(marinaId)) {
      newSelected.delete(marinaId);
    } else {
      newSelected.add(marinaId);
    }
    setSelectedMarinaIds(newSelected);
  };

  const handleConfirm = () => {
    onSelect(Array.from(selectedMarinaIds));
    setSelectedMarinaIds(new Set());
    setSearchTerm("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedMarinaIds(new Set());
    setSearchTerm("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Existing Marinas</DialogTitle>
          <DialogDescription>
            Choose marinas to add to this portfolio. Selected marinas will be moved from individual sales to this portfolio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search marinas by name, state, or market..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-marinas"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedMarinaIds.size === filteredMarinas.length && filteredMarinas.length > 0}
                        onCheckedChange={handleSelectAll}
                        data-testid="checkbox-select-all-marinas"
                      />
                    </TableHead>
                    <TableHead>Marina</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Sale Price</TableHead>
                    <TableHead>Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMarinas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {availableMarinas.length === 0 
                          ? "No available marinas to add to portfolio"
                          : "No marinas match your search criteria"
                        }
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMarinas.map((marina) => (
                      <TableRow 
                        key={marina.id}
                        className={`cursor-pointer hover:bg-muted/50 ${
                          selectedMarinaIds.has(marina.id) ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleSelectMarina(marina.id)}
                        data-testid={`row-marina-${marina.id}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMarinaIds.has(marina.id)}
                            onCheckedChange={() => handleSelectMarina(marina.id)}
                            data-testid={`checkbox-marina-${marina.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{marina.marina}</TableCell>
                        <TableCell>{marina.state || '—'}</TableCell>
                        <TableCell>{marina.market || '—'}</TableCell>
                        <TableCell>
                          {marina.isPriceDisclosed && marina.salePrice 
                            ? formatCurrency(Number(marina.salePrice)) 
                            : 'Undisclosed'
                          }
                        </TableCell>
                        <TableCell>{marina.saleYear || '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            data-testid="button-cancel-marina-selection"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={selectedMarinaIds.size === 0}
            data-testid="button-confirm-marina-selection"
          >
            Add {selectedMarinaIds.size} Marina{selectedMarinaIds.size !== 1 ? 's' : ''} to Portfolio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}