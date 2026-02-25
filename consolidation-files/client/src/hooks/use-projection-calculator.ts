import { useState, useCallback } from 'react';

export type ProjectionFields = {
  revenue: string;
  gallons: string;
  costs: string;
  profitMargin: string;
  avgPricePerGallon: string;
};

type FieldName = keyof ProjectionFields;

export function useProjectionCalculator(initialValues?: Partial<ProjectionFields>) {
  const [values, setValues] = useState<ProjectionFields>({
    revenue: initialValues?.revenue || '',
    gallons: initialValues?.gallons || '',
    costs: initialValues?.costs || '',
    profitMargin: initialValues?.profitMargin || '',
    avgPricePerGallon: initialValues?.avgPricePerGallon || '',
  });

  const [lastEdited, setLastEdited] = useState<FieldName | null>(null);

  const parseValue = (value: string): number => {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatValue = (value: number, decimals: number = 2): string => {
    if (!isFinite(value)) return '0';
    return value.toFixed(decimals);
  };

  const hasValue = (value: string): boolean => {
    return value.trim() !== '';
  };

  const solve = useCallback((field: FieldName, newValue: string): ProjectionFields => {
    const updatedValues = { ...values, [field]: newValue };
    
    if (newValue.trim() === '') {
      return updatedValues;
    }
    
    const revenue = parseValue(updatedValues.revenue);
    const gallons = parseValue(updatedValues.gallons);
    const costs = parseValue(updatedValues.costs);
    const margin = parseValue(updatedValues.profitMargin);
    const avgPrice = parseValue(updatedValues.avgPricePerGallon);

    switch (field) {
      case 'profitMargin': {
        if (revenue > 0 && updatedValues.profitMargin.trim() !== '') {
          const newCosts = revenue * (1 - margin / 100);
          updatedValues.costs = newCosts >= 0 ? formatValue(newCosts) : '0';
        }
        if (gallons > 0 && revenue > 0) {
          updatedValues.avgPricePerGallon = formatValue(revenue / gallons, 3);
        }
        break;
      }

      case 'revenue': {
        if (hasValue(updatedValues.profitMargin)) {
          const newCosts = revenue * (1 - margin / 100);
          updatedValues.costs = newCosts >= 0 ? formatValue(newCosts) : '0';
        } else if (hasValue(updatedValues.costs) && revenue > 0) {
          const newMargin = ((revenue - costs) / revenue) * 100;
          updatedValues.profitMargin = formatValue(newMargin, 1);
        }
        
        if (gallons > 0 && revenue > 0) {
          updatedValues.avgPricePerGallon = formatValue(revenue / gallons, 3);
        }
        break;
      }

      case 'gallons': {
        if (revenue > 0 && gallons > 0) {
          updatedValues.avgPricePerGallon = formatValue(revenue / gallons, 3);
        } else if (avgPrice > 0 && gallons > 0) {
          const newRevenue = gallons * avgPrice;
          updatedValues.revenue = formatValue(newRevenue);
          
          if (hasValue(updatedValues.profitMargin)) {
            const newCosts = newRevenue * (1 - margin / 100);
            updatedValues.costs = formatValue(newCosts);
          } else if (hasValue(updatedValues.costs) && newRevenue > 0) {
            const newMargin = ((newRevenue - costs) / newRevenue) * 100;
            updatedValues.profitMargin = formatValue(newMargin, 1);
          }
        }
        break;
      }

      case 'costs': {
        if (revenue > 0) {
          const newMargin = ((revenue - costs) / revenue) * 100;
          updatedValues.profitMargin = formatValue(newMargin, 1);
        }
        break;
      }

      case 'avgPricePerGallon': {
        if (gallons > 0 && avgPrice > 0) {
          const newRevenue = gallons * avgPrice;
          updatedValues.revenue = formatValue(newRevenue);
          
          if (hasValue(updatedValues.profitMargin)) {
            const newCosts = newRevenue * (1 - margin / 100);
            updatedValues.costs = formatValue(newCosts);
          } else if (hasValue(updatedValues.costs) && newRevenue > 0) {
            const newMargin = ((newRevenue - costs) / newRevenue) * 100;
            updatedValues.profitMargin = formatValue(newMargin, 1);
          }
        }
        break;
      }
    }

    return updatedValues;
  }, [values]);

  const updateField = useCallback((field: FieldName, value: string) => {
    setLastEdited(field);
    const newValues = solve(field, value);
    setValues(newValues);
  }, [solve]);

  const reset = useCallback((newValues?: Partial<ProjectionFields>) => {
    setValues({
      revenue: newValues?.revenue || '',
      gallons: newValues?.gallons || '',
      costs: newValues?.costs || '',
      profitMargin: newValues?.profitMargin || '',
      avgPricePerGallon: newValues?.avgPricePerGallon || '',
    });
    setLastEdited(null);
  }, []);

  return {
    values,
    updateField,
    reset,
    lastEdited,
  };
}
