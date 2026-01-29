import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Maximize2,
  Minimize2,
  Hash,
  Eye,
  Table,
} from 'lucide-react';
import type { UserSettings, UserProfile, Organization } from '@/types/settings';

interface DisplaySettingsProps {
  settings: UserSettings;
  profile: UserProfile;
  organization: Organization | null;
  onChange: (updates: Partial<UserSettings>) => void;
}

export function DisplaySettings({
  settings,
  onChange,
}: DisplaySettingsProps) {
  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value: 'light' | 'dark' | 'system') =>
              onChange({ theme: value })
            }
            className="grid grid-cols-3 gap-4"
          >
            <div>
              <RadioGroupItem
                value="light"
                id="theme-light"
                className="peer sr-only"
              />
              <Label
                htmlFor="theme-light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Light</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="dark"
                id="theme-dark"
                className="peer sr-only"
              />
              <Label
                htmlFor="theme-dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Dark</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="system"
                id="theme-system"
                className="peer sr-only"
              />
              <Label
                htmlFor="theme-system"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Monitor className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">System</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Density */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5" />
            Display Density
          </CardTitle>
          <CardDescription>Adjust spacing and sizing of elements</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.density}
            onValueChange={(value: 'comfortable' | 'compact') =>
              onChange({ density: value })
            }
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="comfortable"
                id="density-comfortable"
                className="peer sr-only"
              />
              <Label
                htmlFor="density-comfortable"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Maximize2 className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Comfortable</span>
                <span className="text-xs text-muted-foreground mt-1">
                  More spacing, easier to read
                </span>
              </Label>
            </div>
            <div>
              <RadioGroupItem
                value="compact"
                id="density-compact"
                className="peer sr-only"
              />
              <Label
                htmlFor="density-compact"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Minimize2 className="mb-3 h-6 w-6" />
                <span className="text-sm font-medium">Compact</span>
                <span className="text-xs text-muted-foreground mt-1">
                  More content visible
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Number Formatting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Number Formatting
          </CardTitle>
          <CardDescription>Configure how numbers are displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Thousands Separator</Label>
            <Select
              value={settings.numberFormat}
              onValueChange={(value: 'comma' | 'space' | 'none') =>
                onChange({ numberFormat: value })
              }
            >
              <SelectTrigger className="w-full md:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">
                  Comma (1,234,567)
                </SelectItem>
                <SelectItem value="space">
                  Space (1 234 567)
                </SelectItem>
                <SelectItem value="none">
                  None (1234567)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Decimal Precision</Label>
              <span className="text-sm text-muted-foreground">
                {settings.decimalPrecision} decimal places
              </span>
            </div>
            <Slider
              value={[settings.decimalPrecision]}
              onValueChange={([value]) => onChange({ decimalPrecision: value })}
              min={0}
              max={6}
              step={1}
              className="w-full md:w-72"
            />
            <p className="text-sm text-muted-foreground">
              Example: {(1234567.89).toLocaleString('en-US', {
                minimumFractionDigits: settings.decimalPrecision,
                maximumFractionDigits: settings.decimalPrecision,
              })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Table Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Table className="h-5 w-5" />
            Table Display
          </CardTitle>
          <CardDescription>Configure table appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Sticky Headers</Label>
              <p className="text-sm text-muted-foreground">
                Keep table headers visible when scrolling
              </p>
            </div>
            <Switch
              checked={settings.stickyHeaders}
              onCheckedChange={(checked) => onChange({ stickyHeaders: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Accessibility
          </CardTitle>
          <CardDescription>Motion and accessibility preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Reduce Motion</Label>
              <p className="text-sm text-muted-foreground">
                Minimize animations and transitions
              </p>
            </div>
            <Switch
              checked={settings.reducedMotion}
              onCheckedChange={(checked) => onChange({ reducedMotion: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-save */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Save</CardTitle>
          <CardDescription>Save changes automatically as you make them</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Auto-Save</Label>
              <p className="text-sm text-muted-foreground">
                Changes are saved immediately without clicking Save
              </p>
            </div>
            <Switch
              checked={settings.autoSave}
              onCheckedChange={(checked) => onChange({ autoSave: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}