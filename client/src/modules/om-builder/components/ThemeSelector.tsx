import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Palette, Plus, Pencil, Copy, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { OmTheme } from "../types";
import { defaultThemes } from "../types";

interface ThemeSelectorProps {
  selectedThemeId: string | null;
  onSelectTheme: (theme: OmTheme) => void;
}

interface ThemeFromApi {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  userId: string | null;
  isSystemDefault: boolean;
  baseThemeKey: string | null;
  colors: OmTheme['colors'];
  typography: OmTheme['typography'];
  branding: OmTheme['branding'];
  spacing: OmTheme['spacing'];
  createdAt: string;
  updatedAt: string;
}

function mapApiThemeToOmTheme(apiTheme: ThemeFromApi): OmTheme {
  return {
    id: apiTheme.id,
    name: apiTheme.name,
    description: apiTheme.description ?? undefined,
    organizationId: apiTheme.organizationId ?? undefined,
    userId: apiTheme.userId ?? undefined,
    isSystemDefault: apiTheme.isSystemDefault,
    baseThemeKey: apiTheme.baseThemeKey ?? undefined,
    colors: apiTheme.colors,
    typography: apiTheme.typography || {},
    branding: apiTheme.branding || {},
    spacing: apiTheme.spacing || {},
  };
}

export function ThemeSelector({ selectedThemeId, onSelectTheme }: ThemeSelectorProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<OmTheme | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: apiThemes = [], isLoading } = useQuery<ThemeFromApi[]>({
    queryKey: ['/api/om/themes'],
  });

  const themes: OmTheme[] = apiThemes.length > 0 
    ? apiThemes.map(mapApiThemeToOmTheme)
    : defaultThemes;

  const createThemeMutation = useMutation({
    mutationFn: async (theme: Partial<OmTheme>) => {
      return apiRequest('/api/om/themes', {
        method: 'POST',
        body: JSON.stringify(theme),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/themes'] });
      setIsEditorOpen(false);
      setEditingTheme(null);
      setIsCreating(false);
      toast({ title: "Theme created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create theme", variant: "destructive" });
    },
  });

  const updateThemeMutation = useMutation({
    mutationFn: async (theme: OmTheme) => {
      return apiRequest(`/api/om/themes/${theme.id}`, {
        method: 'PUT',
        body: JSON.stringify(theme),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/themes'] });
      setIsEditorOpen(false);
      setEditingTheme(null);
      toast({ title: "Theme updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update theme", variant: "destructive" });
    },
  });

  const deleteThemeMutation = useMutation({
    mutationFn: async (themeId: string) => {
      return apiRequest(`/api/om/themes/${themeId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/om/themes'] });
      toast({ title: "Theme deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete theme", variant: "destructive" });
    },
  });

  const handleCreateNew = () => {
    setIsCreating(true);
    setEditingTheme({
      id: '',
      name: 'New Theme',
      colors: {
        primary: '#1a365d',
        secondary: '#2c5282',
        accent: '#3182ce',
        background: '#ffffff',
        text: '#1a202c',
      },
      typography: {
        headingFont: 'font-serif',
        bodyFont: 'font-sans',
      },
      spacing: {
        blockGap: '1.5rem',
        pagePadding: '2rem',
      },
    });
    setIsEditorOpen(true);
  };

  const handleDuplicate = (theme: OmTheme) => {
    setIsCreating(true);
    setEditingTheme({
      ...theme,
      id: '',
      name: `${theme.name} (Copy)`,
      isSystemDefault: false,
    });
    setIsEditorOpen(true);
  };

  const handleEdit = (theme: OmTheme) => {
    if (theme.isSystemDefault) {
      toast({ title: "System themes cannot be edited. Duplicate to create a custom version.", variant: "destructive" });
      return;
    }
    setIsCreating(false);
    setEditingTheme({ ...theme });
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (!editingTheme) return;
    if (isCreating) {
      const { id, ...themeData } = editingTheme;
      createThemeMutation.mutate(themeData);
    } else {
      updateThemeMutation.mutate(editingTheme);
    }
  };

  const handleDelete = (themeId: string) => {
    const theme = themes.find(t => t.id === themeId);
    if (theme?.isSystemDefault) {
      toast({ title: "System themes cannot be deleted", variant: "destructive" });
      return;
    }
    if (confirm("Are you sure you want to delete this theme?")) {
      deleteThemeMutation.mutate(themeId);
    }
  };

  const updateEditingTheme = (updates: Partial<OmTheme>) => {
    if (editingTheme) {
      setEditingTheme({ ...editingTheme, ...updates });
    }
  };

  const updateColor = (colorKey: keyof OmTheme['colors'], value: string) => {
    if (editingTheme) {
      setEditingTheme({
        ...editingTheme,
        colors: { ...editingTheme.colors, [colorKey]: value },
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Theme</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCreateNew} data-testid="button-create-theme">
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <ScrollArea className="h-[180px]">
        <div className="space-y-1 pr-2">
          {isLoading ? (
            <div className="text-xs text-muted-foreground text-center py-4">Loading themes...</div>
          ) : (
            themes.map((theme) => (
              <div
                key={theme.id}
                className={`group flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer ${
                  theme.id === selectedThemeId 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => onSelectTheme(theme)}
                data-testid={`theme-option-${theme.id}`}
              >
                <div 
                  className="w-6 h-6 rounded-full border border-border flex items-center justify-center shrink-0" 
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.primary} 50%, ${theme.colors.secondary || theme.colors.accent} 50%)` 
                  }}
                >
                  {theme.id === selectedThemeId && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{theme.name}</div>
                  {theme.isSystemDefault && (
                    <div className="text-[10px] text-muted-foreground">System</div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(theme); }}
                    data-testid={`button-duplicate-theme-${theme.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  {!theme.isSystemDefault && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); handleEdit(theme); }}
                        data-testid={`button-edit-theme-${theme.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDelete(theme.id); }}
                        data-testid={`button-delete-theme-${theme.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {isCreating ? 'Create Theme' : 'Edit Theme'}
            </DialogTitle>
            <DialogDescription>
              Customize colors, typography, and spacing for your document.
            </DialogDescription>
          </DialogHeader>

          {editingTheme && (
            <Tabs defaultValue="colors" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="typography">Typography</TabsTrigger>
                <TabsTrigger value="spacing">Spacing</TabsTrigger>
              </TabsList>

              <TabsContent value="colors" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="theme-name">Theme Name</Label>
                  <Input
                    id="theme-name"
                    value={editingTheme.name}
                    onChange={(e) => updateEditingTheme({ name: e.target.value })}
                    data-testid="input-theme-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingTheme.colors.primary}
                        onChange={(e) => updateColor('primary', e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        data-testid="input-color-primary"
                      />
                      <Input
                        value={editingTheme.colors.primary}
                        onChange={(e) => updateColor('primary', e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Secondary Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingTheme.colors.secondary}
                        onChange={(e) => updateColor('secondary', e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        data-testid="input-color-secondary"
                      />
                      <Input
                        value={editingTheme.colors.secondary}
                        onChange={(e) => updateColor('secondary', e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingTheme.colors.accent}
                        onChange={(e) => updateColor('accent', e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        data-testid="input-color-accent"
                      />
                      <Input
                        value={editingTheme.colors.accent}
                        onChange={(e) => updateColor('accent', e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingTheme.colors.background}
                        onChange={(e) => updateColor('background', e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        data-testid="input-color-background"
                      />
                      <Input
                        value={editingTheme.colors.background}
                        onChange={(e) => updateColor('background', e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingTheme.colors.text}
                        onChange={(e) => updateColor('text', e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                        data-testid="input-color-text"
                      />
                      <Input
                        value={editingTheme.colors.text}
                        onChange={(e) => updateColor('text', e.target.value)}
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border mt-4">
                  <div className="text-xs text-muted-foreground mb-2">Preview</div>
                  <div 
                    className="rounded-lg p-4"
                    style={{ backgroundColor: editingTheme.colors.background }}
                  >
                    <h3 style={{ color: editingTheme.colors.primary }} className="font-bold text-lg">
                      Section Heading
                    </h3>
                    <p style={{ color: editingTheme.colors.text }} className="text-sm mt-1">
                      This is sample body text to preview the theme colors.
                    </p>
                    <div 
                      className="inline-block px-3 py-1 rounded mt-2 text-white text-sm"
                      style={{ backgroundColor: editingTheme.colors.accent }}
                    >
                      Accent Button
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="typography" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Heading Font</Label>
                    <Select
                      value={editingTheme.typography?.headingFont || 'font-serif'}
                      onValueChange={(value) => updateEditingTheme({
                        typography: { ...editingTheme.typography, headingFont: value }
                      })}
                    >
                      <SelectTrigger data-testid="select-heading-font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="font-sans">Sans Serif</SelectItem>
                        <SelectItem value="font-serif">Serif</SelectItem>
                        <SelectItem value="font-mono">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Body Font</Label>
                    <Select
                      value={editingTheme.typography?.bodyFont || 'font-sans'}
                      onValueChange={(value) => updateEditingTheme({
                        typography: { ...editingTheme.typography, bodyFont: value }
                      })}
                    >
                      <SelectTrigger data-testid="select-body-font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="font-sans">Sans Serif</SelectItem>
                        <SelectItem value="font-serif">Serif</SelectItem>
                        <SelectItem value="font-mono">Monospace</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="spacing" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Block Gap</Label>
                    <Select
                      value={editingTheme.spacing?.blockGap || '1.5rem'}
                      onValueChange={(value) => updateEditingTheme({
                        spacing: { ...editingTheme.spacing, blockGap: value }
                      })}
                    >
                      <SelectTrigger data-testid="select-block-gap">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1rem">Compact (1rem)</SelectItem>
                        <SelectItem value="1.25rem">Normal (1.25rem)</SelectItem>
                        <SelectItem value="1.5rem">Comfortable (1.5rem)</SelectItem>
                        <SelectItem value="2rem">Spacious (2rem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Page Padding</Label>
                    <Select
                      value={editingTheme.spacing?.pagePadding || '2rem'}
                      onValueChange={(value) => updateEditingTheme({
                        spacing: { ...editingTheme.spacing, pagePadding: value }
                      })}
                    >
                      <SelectTrigger data-testid="select-page-padding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.5rem">Narrow (1.5rem)</SelectItem>
                        <SelectItem value="2rem">Normal (2rem)</SelectItem>
                        <SelectItem value="2.5rem">Wide (2.5rem)</SelectItem>
                        <SelectItem value="3rem">Extra Wide (3rem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={createThemeMutation.isPending || updateThemeMutation.isPending}
              data-testid="button-save-theme"
            >
              {createThemeMutation.isPending || updateThemeMutation.isPending ? 'Saving...' : 'Save Theme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
