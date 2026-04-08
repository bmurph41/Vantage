/**
 * MM-UI Demo Page
 * 
 * Demonstrates all Vantage Modal Standard components:
 * - 3-step New Project wizard
 * - New Contact modal with form fields
 * - Radio card selection example
 * - All input variants
 */

import React, { useState } from 'react';
import {
  MMModal,
  MMModalWizard,
  MMModalStepHeader,
  MMModalSection,
  MMWizardStep,
  MMFormGrid,
  MMFormRow,
  MMInput,
  MMEmailInput,
  MMPhoneInput,
  MMCurrencyInput,
  MMSelect,
  MMStateSelect,
  MMTextarea,
  MMComboBox,
  MMRadioCardGroup,
} from '../components/mm-ui';
import {
  Anchor,
  User,
  Building2,
  MapPin,
  DollarSign,
  Ship,
  Warehouse,
  TrendingUp,
  FileText,
  Users,
  Briefcase,
} from 'lucide-react';

// ============================================
// Demo Data
// ============================================

const PROJECT_TYPES = [
  {
    value: 'acquisition',
    title: 'Acquisition',
    description: 'Purchase and value an existing marina property',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: 'development',
    title: 'New Development',
    description: 'Ground-up marina development project',
    icon: <Warehouse className="w-5 h-5" />,
  },
  {
    value: 'renovation',
    title: 'Renovation',
    description: 'Major improvement to existing property',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    value: 'portfolio',
    title: 'Portfolio Analysis',
    description: 'Multi-property portfolio valuation',
    icon: <FileText className="w-5 h-5" />,
  },
];

const CONTACT_TYPES = [
  {
    value: 'owner',
    title: 'Marina Owner',
    description: 'Property owner or seller',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    value: 'broker',
    title: 'Broker',
    description: 'Real estate or marina broker',
    icon: <Users className="w-5 h-5" />,
  },
  {
    value: 'investor',
    title: 'Investor',
    description: 'Potential investment partner',
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    value: 'vendor',
    title: 'Vendor/Supplier',
    description: 'Service or equipment provider',
    icon: <Ship className="w-5 h-5" />,
  },
];

const COMPANY_OPTIONS = [
  { value: 'safe-harbor', label: 'Safe Harbor Marinas', description: 'Marina operator' },
  { value: 'valiant-yachts', label: 'Valiant Yachts', description: 'Yacht manufacturer' },
  { value: 'marinemax', label: 'MarineMax', description: 'Boat retailer' },
  { value: 'brunswick', label: 'Brunswick Corporation', description: 'Marine products' },
  { value: 'custom', label: 'Add new company...', description: 'Create a new entry' },
];

// ============================================
// New Project Wizard Demo
// ============================================

interface NewProjectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewProjectWizard({ open, onOpenChange }: NewProjectWizardProps) {
  const [projectType, setProjectType] = useState('');
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [askingPrice, setAskingPrice] = useState('');
  const [slipCount, setSlipCount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: 'Type', title: 'Project Type', subtitle: 'What type of project is this?' },
    { label: 'Details', title: 'Deal Details', subtitle: 'Enter the basic project information' },
    { label: 'Summary', title: 'Review & Create', subtitle: 'Confirm your project details' },
  ];

  // Validation for each step
  const isStep1Valid = !!projectType;
  const isStep2Valid = !!projectName && !!address && !!city && !!state && !!zipCode;
  const isCurrentStepValid = currentStep === 0 ? isStep1Valid : currentStep === 1 ? isStep2Valid : true;

  const handleNext = () => {
    if (currentStep === 2) {
      // Submit
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        onOpenChange(false);
        // Reset form
        setProjectType('');
        setProjectName('');
        setAddress('');
        setCity('');
        setState('');
        setZipCode('');
        setAskingPrice('');
        setSlipCount('');
        setNotes('');
        setCurrentStep(0);
      }, 1500);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const selectedType = PROJECT_TYPES.find((t) => t.value === projectType);

  return (
    <MMModalWizard
      open={open}
      onOpenChange={onOpenChange}
      title="New Project"
      subtitle="Create a new marina investment project"
      icon={<Anchor className="w-5 h-5" />}
      steps={steps}
      onStepChange={setCurrentStep}
      onNext={handleNext}
      onBack={handleBack}
      isStepValid={isCurrentStepValid}
      isLoading={isLoading}
      submitLabel="Create Project"
      renderStep={(step) => (
        <>
          {/* Step 1: Project Type */}
          <MMWizardStep currentStep={step} stepIndex={0}>
            <MMRadioCardGroup
              label="What type of project is this? *"
              options={PROJECT_TYPES}
              value={projectType}
              onChange={setProjectType}
              columns={2}
              direction="horizontal"
              required
            />
          </MMWizardStep>

          {/* Step 2: Deal Details */}
          <MMWizardStep currentStep={step} stepIndex={1}>
            <div className="space-y-6">
              <MMInput
                label="Project Name"
                placeholder="e.g., Marina Bay Acquisition"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />

              <MMFormRow>
                <MMInput
                  label="Street Address"
                  placeholder="123 Harbor Drive"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  leftIcon={<MapPin className="w-4 h-4" />}
                  required
                />
              </MMFormRow>

              <MMFormGrid columns={3}>
                <MMInput
                  label="City"
                  placeholder="Miami"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <MMStateSelect
                  label="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                />
                <MMInput
                  label="ZIP Code"
                  placeholder="33101"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  required
                />
              </MMFormGrid>

              <MMFormGrid columns={2}>
                <MMCurrencyInput
                  label="Asking Price"
                  placeholder="5,000,000"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  helperText="Leave blank if unknown"
                />
                <MMInput
                  label="Slip Count"
                  type="number"
                  placeholder="150"
                  value={slipCount}
                  onChange={(e) => setSlipCount(e.target.value)}
                  leftIcon={<Ship className="w-4 h-4" />}
                />
              </MMFormGrid>

              <MMTextarea
                label="Notes"
                placeholder="Add any additional notes about this project..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                showCharCount
              />
            </div>
          </MMWizardStep>

          {/* Step 3: Summary */}
          <MMWizardStep currentStep={step} stepIndex={2}>
            <div className="space-y-6">
              <div
                className="p-4 rounded-lg"
                style={{ backgroundColor: 'var(--mm-bg)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {selectedType?.icon && (
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--mm-primary)' }}
                    >
                      {selectedType.icon}
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold" style={{ color: 'var(--mm-text)' }}>
                      {projectName || 'Untitled Project'}
                    </h4>
                    <p className="text-sm" style={{ color: 'var(--mm-text-secondary)' }}>
                      {selectedType?.title || 'No type selected'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--mm-text-muted)' }}>Address</span>
                    <span style={{ color: 'var(--mm-text)' }}>
                      {address}, {city}, {state} {zipCode}
                    </span>
                  </div>
                  {askingPrice && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--mm-text-muted)' }}>Asking Price</span>
                      <span style={{ color: 'var(--mm-text)' }}>${askingPrice}</span>
                    </div>
                  )}
                  {slipCount && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--mm-text-muted)' }}>Slips</span>
                      <span style={{ color: 'var(--mm-text)' }}>{slipCount}</span>
                    </div>
                  )}
                </div>
              </div>

              {notes && (
                <div>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--mm-text-secondary)' }}>
                    Notes
                  </h4>
                  <p className="text-sm" style={{ color: 'var(--mm-text)' }}>
                    {notes}
                  </p>
                </div>
              )}
            </div>
          </MMWizardStep>
        </>
      )}
    />
  );
}

// ============================================
// New Contact Modal Demo
// ============================================

interface NewContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewContactModal({ open, onOpenChange }: NewContactModalProps) {
  const [contactType, setContactType] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!contactType) newErrors.contactType = 'Please select a contact type';
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onOpenChange(false);
      // Reset form
      setContactType('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setTitle('');
      setNotes('');
      setErrors({});
    }, 1500);
  };

  const isFormValid = contactType && firstName && lastName && email;

  return (
    <MMModal
      open={open}
      onOpenChange={onOpenChange}
      title="New Contact"
      subtitle="Add a new contact to your CRM"
      icon={<User className="w-5 h-5" />}
      size="lg"
      footerLeft={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="mm-btn mm-btn-ghost"
        >
          Cancel
        </button>
      }
      footerRight={
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isFormValid || isLoading}
          className="mm-btn mm-btn-primary"
        >
          {isLoading ? 'Saving...' : 'Create Contact'}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Contact Type */}
        <MMModalSection title="Contact Type">
          <MMRadioCardGroup
            label="What type of contact is this? *"
            options={CONTACT_TYPES}
            value={contactType}
            onChange={setContactType}
            columns={2}
            direction="horizontal"
            required
            errorMessage={errors.contactType}
          />
        </MMModalSection>

        {/* Basic Information */}
        <MMModalSection title="Basic Information">
          <div className="space-y-4">
            <MMFormGrid columns={2}>
              <MMInput
                label="First Name"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                errorMessage={errors.firstName}
              />
              <MMInput
                label="Last Name"
                placeholder="Smith"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                errorMessage={errors.lastName}
              />
            </MMFormGrid>

            <MMFormGrid columns={2}>
              <MMEmailInput
                label="Email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                errorMessage={errors.email}
              />
              <MMPhoneInput
                label="Phone"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </MMFormGrid>
          </div>
        </MMModalSection>

        {/* Company Information */}
        <MMModalSection title="Company Information">
          <div className="space-y-4">
            <MMFormGrid columns={2}>
              <MMComboBox
                label="Company"
                placeholder="Search or add company..."
                options={COMPANY_OPTIONS}
                value={company}
                onChange={setCompany}
                allowCustomValue
              />
              <MMInput
                label="Job Title"
                placeholder="e.g., Marina Manager"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </MMFormGrid>
          </div>
        </MMModalSection>

        {/* Notes */}
        <MMModalSection title="Additional Notes">
          <MMTextarea
            placeholder="Add any notes about this contact..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </MMModalSection>
      </div>
    </MMModal>
  );
}

// ============================================
// Main Demo Page
// ============================================

export default function MMUIDemo() {
  const [projectWizardOpen, setProjectWizardOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--mm-bg)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: 'var(--mm-text)' }}
          >
            MM-UI Component Library
          </h1>
          <p style={{ color: 'var(--mm-text-secondary)' }}>
            Vantage Modal Standard Design System
          </p>
        </div>

        {/* Demo Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <button
            onClick={() => setProjectWizardOpen(true)}
            className="mm-btn mm-btn-primary h-14 text-lg"
          >
            <Anchor className="w-5 h-5" />
            New Project Wizard
          </button>
          <button
            onClick={() => setContactModalOpen(true)}
            className="mm-btn mm-btn-primary h-14 text-lg"
          >
            <User className="w-5 h-5" />
            New Contact Modal
          </button>
        </div>

        {/* Input Examples */}
        <div
          className="p-6 rounded-xl mb-8"
          style={{ backgroundColor: 'var(--mm-surface)', boxShadow: 'var(--mm-shadow)' }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--mm-text)' }}>
            Input Components
          </h2>

          <div className="space-y-6">
            <MMFormGrid columns={2}>
              <MMInput
                label="Text Input"
                placeholder="Enter text..."
                required
              />
              <MMInput
                label="With Error"
                placeholder="Enter text..."
                value="Invalid value"
                errorMessage="This field has an error"
              />
            </MMFormGrid>

            <MMFormGrid columns={2}>
              <MMEmailInput
                label="Email Input"
                placeholder="email@example.com"
              />
              <MMPhoneInput
                label="Phone Input"
                placeholder="(555) 123-4567"
              />
            </MMFormGrid>

            <MMFormGrid columns={2}>
              <MMCurrencyInput
                label="Currency Input"
                placeholder="1,000,000"
              />
              <MMSelect
                label="Select Input"
                placeholder="Choose an option..."
                options={[
                  { value: '1', label: 'Option 1' },
                  { value: '2', label: 'Option 2' },
                  { value: '3', label: 'Option 3' },
                ]}
              />
            </MMFormGrid>

            <MMComboBox
              label="Combobox / Autocomplete"
              placeholder="Search companies..."
              options={COMPANY_OPTIONS}
            />

            <MMTextarea
              label="Textarea"
              placeholder="Enter longer text here..."
              rows={4}
              maxLength={200}
              showCharCount
            />
          </div>
        </div>

        {/* Radio Cards Example */}
        <div
          className="p-6 rounded-xl"
          style={{ backgroundColor: 'var(--mm-surface)', boxShadow: 'var(--mm-shadow)' }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--mm-text)' }}>
            Radio Card Selection
          </h2>

          <MMRadioCardGroup
            label="Select a project type"
            options={PROJECT_TYPES}
            columns={2}
            direction="horizontal"
          />
        </div>
      </div>

      {/* Modals */}
      <NewProjectWizard open={projectWizardOpen} onOpenChange={setProjectWizardOpen} />
      <NewContactModal open={contactModalOpen} onOpenChange={setContactModalOpen} />
    </div>
  );
}
