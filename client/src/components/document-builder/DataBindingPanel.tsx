/**
 * Data Binding Panel
 * Step 4: Connect data sources to document sections
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  useDocumentBuilderStore,
  useDocument,
  useSectionLibrary,
  useSections,
  useBindingsCatalog,
} from '@/stores/document-builder-store';
import { DataSource, ResolvedBinding, SectionDefinition } from '@shared/document-builder/types';
import {
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  Link,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Building,
  DollarSign,
  Users,
  MapPin,
  BarChart2,
  FileText,
  Loader2,
  Copy,
  Lock,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// =============================================================================
// Data Source Configuration
// =============================================================================

interface DataSourceConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const DATA_SOURCE_CONFIG: Record<DataSource, DataSourceConfig> = {
  deal: {
    label: 'Deal',
    icon: FileText,
    color: 'bg-blue-500',
    description: 'CRM deal information',
  },
  property: {
    label: 'Property',
    icon: Building,
    color: 'bg-green-500',
    description: 'Property details and amenities',
  },
  modeling: {
    label: 'Financial Model',
    icon: DollarSign,
    color: 'bg-emerald-500',
    description: 'Underwriting and projections',
  },
  rent_roll: {
    label: 'Rent Roll',
    icon: Users,
    color: 'bg-purple-500',
    description: 'Unit-level rent data',
  },
  demographics: {
    label: 'Demographics',
    icon: MapPin,
    color: 'bg-orange-500',
    description: 'Market demographics',
  },
  sales_comps: {
    label: 'Sales Comps',
    icon: BarChart2,
    color: 'bg-cyan-500',
    description: 'Comparable sales data',
  },
  rate_comps: {
    label: 'Rate Comps',
    icon: BarChart2,
    color: 'bg-pink-500',
    description: 'Market rate comparisons',
  },
  due_diligence: {
    label: 'Due Diligence',
    icon: FileText,
    color: 'bg-red-500',
    description: 'DD findings and status',
  },
  manual: {
    label: 'Manual',
    icon: Database,
    color: 'bg-gray-500',
    description: 'Manually entered values',
  },
};

// =============================================================================
// Binding Field Row
// =============================================================================

interface BindingFieldRowProps {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  source: DataSource;
  currentValue?: any;
  isRequired: boolean;
  isBound: boolean;
  isLocked: boolean;
  onBind: () => void;
  onUnbind: () => void;
  onToggleLock: () => void;
  onRefresh: () => void;
}

const BindingFieldRow: React.FC<BindingFieldRowProps> = ({
  fieldKey,
  fieldLabel,
  fieldType,
  source,
  currentValue,
  isRequired,
  isBound,
  isLocked,
  onBind,
  onUnbind,
  onToggleLock,
  onRefresh,
}) => {
  const config = DATA_SOURCE_CONFIG[source];
  
  const formatValue = (value: any): string => {
    if (value === undefined || value === null) return '—';
    if (typeof value === 'number') {
      if (fieldType === 'currency') {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(value);
      }
      if (fieldType === 'percent') {
        return `${(value * 100).toFixed(1)}%`;
      }
      return value.toLocaleString();
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).substring(0, 50) + '...';
    }
    return String(value);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md transition-colors',
        'hover:bg-muted/50',
        isBound && 'bg-green-50 dark:bg-green-950/20'
      )}
    >
      {/* Source indicator */}
      <div
        className={cn(
          'w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0',
          config.color
        )}
      >
        <config.icon className="w-3 h-3" />
      </div>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{fieldLabel}</span>
          {isRequired && (
            <Badge variant="outline" className="text-xs">
              Required
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{source}.{fieldKey}</span>
          <span>•</span>
          <span>{fieldType}</span>
        </div>
      </div>

      {/* Current value */}
      <div className="w-32 text-right">
        {isBound ? (
          <span className="text-sm font-medium truncate block">
            {formatValue(currentValue)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Not bound</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isBound && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleLock}
              title={isLocked ? 'Unlock (allow auto-refresh)' : 'Lock value'}
            >
              {isLocked ? (
                <Lock className="w-3 h-3 text-yellow-500" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              title="Refresh value"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={isBound ? onUnbind : onBind}
          title={isBound ? 'Unbind' : 'Bind'}
        >
          {isBound ? (
            <Unlink className="w-3 h-3 text-destructive" />
          ) : (
            <Link className="w-3 h-3 text-primary" />
          )}
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Section Bindings Card
// =============================================================================

interface SectionBindingsCardProps {
  section: {
    id: number;
    sectionKey: string;
    customTitle: string | null;
    dataBindings: Record<string, ResolvedBinding>;
    completionStatus: any;
  };
  definition: SectionDefinition | null;
  dealId: string;
  onBindingChange: (sectionId: number, bindingKey: string, binding: ResolvedBinding | null) => void;
}

const SectionBindingsCard: React.FC<SectionBindingsCardProps> = ({
  section,
  definition,
  dealId,
  onBindingChange,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isResolving, setIsResolving] = useState(false);

  const requiredBindings = definition?.requiredDataBindings || [];
  const optionalBindings = definition?.optionalDataBindings || [];
  const allBindings = [...requiredBindings, ...optionalBindings];

  const missingRequired = section.completionStatus?.missingRequiredBindings || [];
  const boundCount = Object.keys(section.dataBindings).length;
  const requiredCount = requiredBindings.length;
  const isComplete = missingRequired.length === 0;

  const handleBind = async (binding: typeof allBindings[0]) => {
    setIsResolving(true);
    try {
      // Resolve the binding value
      const response = await fetch('/api/document-builder/bindings/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          bindings: [{
            key: binding.key,
            source: binding.source,
            field: binding.field,
          }],
        }),
      });

      const result = await response.json();
      if (result.success) {
        const resolvedValue = result.data[binding.key];
        onBindingChange(section.id, binding.key, {
          source: binding.source,
          field: binding.field,
          resolvedValue,
          locked: false,
          overridden: false,
        });
      }
    } catch (err) {
      console.error('Failed to resolve binding:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleUnbind = (bindingKey: string) => {
    onBindingChange(section.id, bindingKey, null);
  };

  const handleToggleLock = (bindingKey: string) => {
    const current = section.dataBindings[bindingKey];
    if (current) {
      onBindingChange(section.id, bindingKey, {
        ...current,
        locked: !current.locked,
      });
    }
  };

  const handleRefresh = async (binding: typeof allBindings[0]) => {
    await handleBind(binding);
  };

  const handleBindAll = async () => {
    setIsResolving(true);
    try {
      const unboundBindings = allBindings.filter(
        (b) => !section.dataBindings[b.key]
      );

      if (unboundBindings.length === 0) return;

      const response = await fetch('/api/document-builder/bindings/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          bindings: unboundBindings.map((b) => ({
            key: b.key,
            source: b.source,
            field: b.field,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        unboundBindings.forEach((binding) => {
          const resolvedValue = result.data[binding.key];
          if (resolvedValue !== undefined) {
            onBindingChange(section.id, binding.key, {
              source: binding.source,
              field: binding.field,
              resolvedValue,
              locked: false,
              overridden: false,
            });
          }
        });
      }
    } catch (err) {
      console.error('Failed to bind all:', err);
    } finally {
      setIsResolving(false);
    }
  };

  if (!definition || allBindings.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
            {isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="font-medium flex-1 text-left">
              {section.customTitle || definition.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {boundCount} / {requiredCount} required
              </span>
              {isComplete ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 space-y-1 border-t">
            {/* Bind All Button */}
            {boundCount < allBindings.length && (
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBindAll}
                  disabled={isResolving}
                >
                  {isResolving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  <Link className="w-3 h-3 mr-1" />
                  Bind All
                </Button>
              </div>
            )}

            {/* Required Bindings */}
            {requiredBindings.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Required
                </div>
                {requiredBindings.map((binding) => (
                  <BindingFieldRow
                    key={binding.key}
                    fieldKey={binding.field}
                    fieldLabel={binding.label || binding.key}
                    fieldType={binding.type}
                    source={binding.source}
                    currentValue={section.dataBindings[binding.key]?.resolvedValue}
                    isRequired={true}
                    isBound={!!section.dataBindings[binding.key]}
                    isLocked={section.dataBindings[binding.key]?.locked || false}
                    onBind={() => handleBind(binding)}
                    onUnbind={() => handleUnbind(binding.key)}
                    onToggleLock={() => handleToggleLock(binding.key)}
                    onRefresh={() => handleRefresh(binding)}
                  />
                ))}
              </div>
            )}

            {/* Optional Bindings */}
            {optionalBindings.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Optional
                </div>
                {optionalBindings.map((binding) => (
                  <BindingFieldRow
                    key={binding.key}
                    fieldKey={binding.field}
                    fieldLabel={binding.label || binding.key}
                    fieldType={binding.type}
                    source={binding.source}
                    currentValue={section.dataBindings[binding.key]?.resolvedValue}
                    isRequired={false}
                    isBound={!!section.dataBindings[binding.key]}
                    isLocked={section.dataBindings[binding.key]?.locked || false}
                    onBind={() => handleBind(binding)}
                    onUnbind={() => handleUnbind(binding.key)}
                    onToggleLock={() => handleToggleLock(binding.key)}
                    onRefresh={() => handleRefresh(binding)}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// =============================================================================
// Data Binding Panel
// =============================================================================

export const DataBindingPanel: React.FC = () => {
  const store = useDocumentBuilderStore();
  const document = useDocument();
  const sectionLibrary = useSectionLibrary();
  const sections = useSections();
  const bindingsCatalog = useBindingsCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<DataSource | 'all'>('all');

  // Filter enabled sections with bindings
  const sectionsWithBindings = useMemo(() => {
    return sections
      .filter((s) => s.enabled)
      .filter((s) => {
        const def = sectionLibrary[s.sectionKey];
        return (
          def?.requiredDataBindings?.length ||
          def?.optionalDataBindings?.length
        );
      });
  }, [sections, sectionLibrary]);

  // Calculate overall completion
  const bindingStats = useMemo(() => {
    let totalRequired = 0;
    let totalBound = 0;

    sectionsWithBindings.forEach((section) => {
      const def = sectionLibrary[section.sectionKey];
      if (def?.requiredDataBindings) {
        totalRequired += def.requiredDataBindings.length;
        def.requiredDataBindings.forEach((b) => {
          if (section.dataBindings[b.key]) {
            totalBound++;
          }
        });
      }
    });

    return {
      totalRequired,
      totalBound,
      percentage: totalRequired > 0 ? Math.round((totalBound / totalRequired) * 100) : 100,
    };
  }, [sectionsWithBindings, sectionLibrary]);

  const handleBindingChange = async (
    sectionId: number,
    bindingKey: string,
    binding: ResolvedBinding | null
  ) => {
    if (!document) return;

    // Update local state
    if (binding) {
      store.bindDataToSection(sectionId, bindingKey, binding);
    } else {
      // Remove binding
      const section = sections.find((s) => s.id === sectionId);
      if (section) {
        const newBindings = { ...section.dataBindings };
        delete newBindings[bindingKey];
        store.setDocument({
          ...document,
          sections: document.sections.map((s) =>
            s.id === sectionId ? { ...s, dataBindings: newBindings } : s
          ),
        });
      }
    }

    // Persist to server
    try {
      const section = sections.find((s) => s.id === sectionId);
      const newBindings = binding
        ? { ...section?.dataBindings, [bindingKey]: binding }
        : Object.fromEntries(
            Object.entries(section?.dataBindings || {}).filter(
              ([k]) => k !== bindingKey
            )
          );

      await fetch(
        `/api/document-builder/documents/${document.id}/sections/${sectionId}/bindings`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bindings: newBindings }),
        }
      );
    } catch (err) {
      console.error('Failed to update bindings:', err);
    }
  };

  if (!document) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please create a document first
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-medium">Data Bindings</h3>
            <p className="text-sm text-muted-foreground">
              Connect your data sources to document sections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  bindingStats.percentage === 100
                    ? 'bg-green-500'
                    : 'bg-primary'
                )}
                style={{ width: `${bindingStats.percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {bindingStats.totalBound} / {bindingStats.totalRequired} required
            </span>
          </div>
        </div>
      </div>

      {/* Data Sources Legend */}
      <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
        {Object.entries(DATA_SOURCE_CONFIG).map(([source, config]) => (
          <button
            key={source}
            onClick={() =>
              setFilterSource(
                filterSource === source ? 'all' : (source as DataSource)
              )
            }
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
              filterSource === source
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <div
              className={cn(
                'w-4 h-4 rounded flex items-center justify-center text-white',
                config.color
              )}
            >
              <config.icon className="w-2.5 h-2.5" />
            </div>
            {config.label}
          </button>
        ))}
      </div>

      {/* Section Bindings */}
      <div className="space-y-3">
        {sectionsWithBindings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No sections with data bindings. Add sections that require data.
          </div>
        ) : (
          sectionsWithBindings.map((section) => (
            <SectionBindingsCard
              key={section.id}
              section={section}
              definition={sectionLibrary[section.sectionKey] || null}
              dealId={String(document.dealId)}
              onBindingChange={handleBindingChange}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DataBindingPanel;
