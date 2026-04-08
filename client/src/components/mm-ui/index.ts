/**
 * Vantage UI Design System
 * 
 * A comprehensive modal and form component library that enforces
 * the Vantage Modal Standard across all interfaces.
 * 
 * @example
 * import { MMModal, MMModalWizard, MMInput, MMSelect } from '@/components/mm-ui';
 */

// CSS (import this in your app entry point)
// import '@/styles/mm-ui.css';

// Types & Utilities
export * from './types';

// Modal Components
export { MMModal, MMModalStepHeader, MMModalSection } from './MMModal';
export { MMModalWizard, MMWizardStep, MMFormGrid, MMFormRow } from './MMModalWizard';

// Field Wrapper
export { MMField, MMLabel, MMErrorText, MMHelperText, useMMField } from './MMField';

// Form Inputs
export { 
  MMInput, 
  MMEmailInput, 
  MMPhoneInput, 
  MMCurrencyInput, 
  MMSearchInput 
} from './MMInput';

export { 
  MMSelect, 
  MMCountrySelect, 
  MMStateSelect 
} from './MMSelect';

export { MMTextarea } from './MMTextarea';
export { MMComboBox } from './MMComboBox';
export { MMRadioCardGroup, MMRadioCard } from './MMRadioCardGroup';

// Re-export common types for convenience
export type { MMModalBaseProps, MMModalWizardProps, MMModalStep } from './types';
