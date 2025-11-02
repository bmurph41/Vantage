import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Trash, Edit, Eye, Settings, GripVertical, Copy,
  Type, Mail, Phone, Calendar, ToggleLeft, ChevronDown,
  FileText, Hash, MapPin, Clock, DollarSign, Star,
  Save, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Form, FormField } from "@shared/schema";

interface FormBuilderProps {
  form?: Form | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FieldTemplate {
  type: string;
  label: string;
  icon: JSX.Element;
  defaultProps: Partial<FormField>;
}

const fieldTemplates: FieldTemplate[] = [
  {
    type: 'text',
    label: 'Text Input',
    icon: <Type className="w-4 h-4" />,
    defaultProps: { fieldType: 'text', label: 'Text Field', required: false }
  },
  {
    type: 'email',
    label: 'Email',
    icon: <Mail className="w-4 h-4" />,
    defaultProps: { fieldType: 'email', label: 'Email Address', required: true, validation: { type: 'email' } }
  },
  {
    type: 'phone',
    label: 'Phone',
    icon: <Phone className="w-4 h-4" />,
    defaultProps: { fieldType: 'phone', label: 'Phone Number', required: false, validation: { type: 'phone' } }
  },
  {
    type: 'number',
    label: 'Number',
    icon: <Hash className="w-4 h-4" />,
    defaultProps: { fieldType: 'number', label: 'Number Field', required: false, validation: { type: 'number' } }
  },
  {
    type: 'textarea',
    label: 'Text Area',
    icon: <FileText className="w-4 h-4" />,
    defaultProps: { fieldType: 'textarea', label: 'Text Area', required: false }
  },
  {
    type: 'select',
    label: 'Dropdown',
    icon: <ChevronDown className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'select', 
      label: 'Select Option', 
      required: false,
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' }
      ]
    }
  },
  {
    type: 'radio',
    label: 'Radio Group',
    icon: <ToggleLeft className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'radio', 
      label: 'Choose One', 
      required: false,
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' }
      ]
    }
  },
  {
    type: 'checkbox',
    label: 'Checkboxes',
    icon: <Checkbox className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'checkbox', 
      label: 'Select All That Apply', 
      required: false,
      options: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' }
      ]
    }
  },
  {
    type: 'date',
    label: 'Date',
    icon: <Calendar className="w-4 h-4" />,
    defaultProps: { fieldType: 'date', label: 'Date', required: false }
  }
];

// Marina-specific field templates
const marinaFieldTemplates: FieldTemplate[] = [
  {
    type: 'boat_length',
    label: 'Boat Length',
    icon: <Hash className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'number', 
      label: 'Boat Length (feet)', 
      required: true,
      validation: { type: 'number', min: 10, max: 200 }
    }
  },
  {
    type: 'boat_type',
    label: 'Boat Type',
    icon: <ChevronDown className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'select', 
      label: 'Boat Type', 
      required: true,
      options: [
        { label: 'Sailboat', value: 'sailboat' },
        { label: 'Motor Yacht', value: 'motor_yacht' },
        { label: 'Fishing Boat', value: 'fishing_boat' },
        { label: 'Catamaran', value: 'catamaran' },
        { label: 'Pontoon Boat', value: 'pontoon' },
        { label: 'Other', value: 'other' }
      ]
    }
  },
  {
    type: 'budget_range',
    label: 'Budget Range',
    icon: <DollarSign className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'select', 
      label: 'Budget Range', 
      required: false,
      options: [
        { label: 'Under $50k', value: 'under_50k' },
        { label: '$50k - $100k', value: '50k_100k' },
        { label: '$100k - $250k', value: '100k_250k' },
        { label: '$250k - $500k', value: '250k_500k' },
        { label: '$500k - $1M', value: '500k_1m' },
        { label: '$1M+', value: 'over_1m' }
      ]
    }
  },
  {
    type: 'marina_amenities',
    label: 'Marina Amenities',
    icon: <Star className="w-4 h-4" />,
    defaultProps: { 
      fieldType: 'checkbox', 
      label: 'Desired Amenities', 
      required: false,
      options: [
        { label: 'Electricity', value: 'electricity' },
        { label: 'Water', value: 'water' },
        { label: 'Wi-Fi', value: 'wifi' },
        { label: '24/7 Security', value: 'security' },
        { label: 'Fuel Dock', value: 'fuel_dock' },
        { label: 'Pump-out Station', value: 'pump_out' },
        { label: 'Laundry Facilities', value: 'laundry' },
        { label: 'Restaurant/Bar', value: 'restaurant' }
      ]
    }
  }
];

export default function FormBuilder({ form, onSave, onCancel }: FormBuilderProps) {
  const [formData, setFormData] = useState<Partial<Form>>({
    name: '',
    description: '',
    type: 'contact',
    status: 'draft',
    settings: {
      redirectUrl: '',
      thankYouMessage: 'Thank you for your submission!',
      submitButtonText: 'Submit',
      enableProgressBar: false,
      enableAutoSave: false,
      showRequiredIndicator: true
    },
    styling: {
      primaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#374151',
      borderRadius: '6',
      spacing: 'normal'
    }
  });
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedField, setSelectedField] = useState<FormField | null>(null);
  const [activeTab, setActiveTab] = useState<string>('build');
  const [previewMode, setPreviewMode] = useState<boolean>(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize form data
  useEffect(() => {
    if (form) {
      setFormData(form);
      setFields(form.fields || []);
    }
  }, [form]);

  // Save form mutation
  const saveForm = useMutation({
    mutationFn: async (data: any) => {
      const url = form?.id ? `/api/forms/${form.id}` : '/api/forms';
      const method = form?.id ? 'PUT' : 'POST';
      return apiRequest(method, url, data);
    },
    onSuccess: () => {
      toast({ title: "Form saved successfully" });
      onSave();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error saving form", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Save fields mutation
  const saveFields = useMutation({
    mutationFn: async (formId: string) => {
      // Delete existing fields and create new ones
      if (form?.id) {
        const existingFields = form.fields || [];
        const fieldPromises = [];
        
        // Delete removed fields
        for (const existingField of existingFields) {
          if (!fields.find(f => f.id === existingField.id)) {
            fieldPromises.push(
              apiRequest('DELETE', `/api/form-fields/${existingField.id}`)
            );
          }
        }

        // Update or create fields
        for (const [index, field] of fields.entries()) {
          const fieldData = { ...field, fieldOrder: index + 1, formId };
          
          if (field.id && existingFields.find(f => f.id === field.id)) {
            // Update existing field
            fieldPromises.push(
              apiRequest('PUT', `/api/form-fields/${field.id}`, fieldData)
            );
          } else {
            // Create new field
            fieldPromises.push(
              apiRequest('POST', `/api/forms/${formId}/fields`, fieldData)
            );
          }
        }

        await Promise.all(fieldPromises);
      } else {
        // Create all fields for new form
        const fieldPromises = fields.map((field, index) => 
          apiRequest('POST', `/api/forms/${formId}/fields`, { ...field, fieldOrder: index + 1, formId })
        );
        await Promise.all(fieldPromises);
      }
    }
  });

  const handleSave = async () => {
    try {
      // Save form first
      const savedForm = await saveForm.mutateAsync(formData);
      
      // Then save fields
      await saveFields.mutateAsync(savedForm.id);
      
      toast({ title: "Form and fields saved successfully" });
      onSave();
    } catch (error: any) {
      toast({ 
        title: "Error saving form", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const addField = (template: FieldTemplate) => {
    const newField: FormField = {
      id: `temp_${Date.now()}`, // Temporary ID
      formId: form?.id || '',
      fieldType: template.defaultProps.fieldType!,
      fieldName: `field_${fields.length + 1}`,
      label: template.defaultProps.label!,
      required: template.defaultProps.required || false,
      fieldOrder: fields.length + 1,
      options: template.defaultProps.options || undefined,
      validation: template.defaultProps.validation || undefined,
      placeholder: '',
      helpText: '',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setFields([...fields, newField]);
    setSelectedField(newField);
  };

  const updateField = (updatedField: FormField) => {
    setFields(fields.map(field => 
      field.id === updatedField.id ? updatedField : field
    ));
    setSelectedField(updatedField);
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(field => field.id !== fieldId));
    setSelectedField(null);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(field => field.id === fieldId);
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < fields.length - 1)
    ) {
      const newFields = [...fields];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
      
      // Update field order
      newFields.forEach((field, i) => {
        field.fieldOrder = i + 1;
      });
      
      setFields(newFields);
    }
  };

  const renderFieldPreview = (field: FormField) => {
    const commonProps = {
      className: "w-full",
      placeholder: field.placeholder || '',
      required: field.required
    };

    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
        return <Input {...commonProps} type={field.fieldType} />;
      case 'number':
        return <Input {...commonProps} type="number" />;
      case 'textarea':
        return <Textarea {...commonProps} />;
      case 'select':
        return (
          <Select>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option, index) => (
                <SelectItem key={index} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup className="flex flex-col space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`${field.id}_${index}`} />
                <Label htmlFor={`${field.id}_${index}`}>{option.label}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Checkbox id={`${field.id}_${index}`} />
                <Label htmlFor={`${field.id}_${index}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        );
      case 'date':
        return <Input {...commonProps} type="date" />;
      default:
        return <Input {...commonProps} />;
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Field Templates */}
      <div className="w-80 border-r bg-gray-50 dark:bg-gray-900/50">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-lg">Form Builder</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Drag fields to build your form
          </p>
        </div>
        
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Basic Fields */}
            <div>
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-200 mb-3">
                Basic Fields
              </h4>
              <div className="space-y-2">
                {fieldTemplates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => addField(template)}
                    data-testid={`button-add-${template.type}`}
                  >
                    <div className="flex items-center">
                      {template.icon}
                      <span className="ml-2 text-sm">{template.label}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Marina-Specific Fields */}
            <div>
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-200 mb-3">
                Marina & Boat Fields
              </h4>
              <div className="space-y-2">
                {marinaFieldTemplates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => addField(template)}
                    data-testid={`button-add-${template.type}`}
                  >
                    <div className="flex items-center">
                      {template.icon}
                      <span className="ml-2 text-sm">{template.label}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Center - Form Preview */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={previewMode ? "outline" : "default"}
              onClick={() => setPreviewMode(false)}
              data-testid="button-edit-mode"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              size="sm"
              variant={previewMode ? "default" : "outline"}
              onClick={() => setPreviewMode(true)}
              data-testid="button-preview-mode"
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveForm.isPending} data-testid="button-save">
              <Save className="w-4 h-4 mr-1" />
              {saveForm.isPending ? 'Saving...' : 'Save Form'}
            </Button>
          </div>
        </div>

        {/* Form Settings Bar */}
        {!previewMode && (
          <div className="p-4 border-b bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input
                  data-testid="input-form-name"
                  placeholder="Form Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="font-medium"
                />
              </div>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger data-testid="select-form-type" className="w-40">
                  <SelectValue placeholder="Form Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact">Contact</SelectItem>
                  <SelectItem value="demo_request">Demo Request</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="property_inquiry">Property Inquiry</SelectItem>
                  <SelectItem value="boat_inquiry">Boat Inquiry</SelectItem>
                  <SelectItem value="quote_request">Quote Request</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-8">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8">
              {/* Form Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {formData.name || 'Untitled Form'}
                </h2>
                {formData.description && (
                  <p className="text-gray-600 dark:text-gray-400">
                    {formData.description}
                  </p>
                )}
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <FileText className="mx-auto h-12 w-12 mb-4" />
                    <p>No fields added yet</p>
                    <p className="text-sm">Add fields from the sidebar to start building your form</p>
                  </div>
                ) : (
                  fields.map((field, index) => (
                    <div
                      key={field.id}
                      className={`group relative p-4 border rounded-lg transition-all ${
                        selectedField?.id === field.id
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      } ${previewMode ? '' : 'cursor-pointer'}`}
                      onClick={() => !previewMode && setSelectedField(field)}
                      data-testid={`field-${field.id}`}
                    >
                      {/* Field Controls */}
                      {!previewMode && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(field.id, 'up');
                              }}
                              disabled={index === 0}
                              data-testid={`button-move-up-${field.id}`}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(field.id, 'down');
                              }}
                              disabled={index === fields.length - 1}
                              data-testid={`button-move-down-${field.id}`}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteField(field.id);
                              }}
                              className="text-red-600 hover:text-red-700"
                              data-testid={`button-delete-${field.id}`}
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Field Content */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        {field.helpText && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {field.helpText}
                          </p>
                        )}
                        {renderFieldPreview(field)}
                      </div>
                    </div>
                  ))
                )}

                {/* Submit Button */}
                {fields.length > 0 && (
                  <div className="pt-6">
                    <Button className="w-full" data-testid="button-form-submit">
                      {formData.settings?.submitButtonText || 'Submit'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Field Settings */}
      {!previewMode && selectedField && (
        <div className="w-80 border-l bg-gray-50 dark:bg-gray-900/50">
          <FieldEditor
            field={selectedField}
            onUpdate={updateField}
            onClose={() => setSelectedField(null)}
          />
        </div>
      )}
    </div>
  );
}

// Field Editor Component
interface FieldEditorProps {
  field: FormField;
  onUpdate: (field: FormField) => void;
  onClose: () => void;
}

function FieldEditor({ field, onUpdate, onClose }: FieldEditorProps) {
  const [localField, setLocalField] = useState<FormField>(field);

  useEffect(() => {
    setLocalField(field);
  }, [field]);

  const handleUpdate = (updates: Partial<FormField>) => {
    const updatedField = { ...localField, ...updates };
    setLocalField(updatedField);
    onUpdate(updatedField);
  };

  const addOption = () => {
    const options = localField.options || [];
    const newOption = { label: `Option ${options.length + 1}`, value: `option${options.length + 1}` };
    handleUpdate({ options: [...options, newOption] });
  };

  const updateOption = (index: number, option: { label: string; value: string }) => {
    const options = [...(localField.options || [])];
    options[index] = option;
    handleUpdate({ options });
  };

  const removeOption = (index: number) => {
    const options = [...(localField.options || [])];
    options.splice(index, 1);
    handleUpdate({ options });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Field Settings</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Basic Settings */}
          <div>
            <h4 className="font-medium mb-3">Basic Settings</h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="field-label">Label</Label>
                <Input
                  id="field-label"
                  value={localField.label}
                  onChange={(e) => handleUpdate({ label: e.target.value })}
                  data-testid="input-field-label"
                />
              </div>

              <div>
                <Label htmlFor="field-name">Field Name</Label>
                <Input
                  id="field-name"
                  value={localField.fieldName}
                  onChange={(e) => handleUpdate({ fieldName: e.target.value })}
                  data-testid="input-field-name"
                />
              </div>

              <div>
                <Label htmlFor="field-placeholder">Placeholder</Label>
                <Input
                  id="field-placeholder"
                  value={localField.placeholder || ''}
                  onChange={(e) => handleUpdate({ placeholder: e.target.value })}
                  data-testid="input-field-placeholder"
                />
              </div>

              <div>
                <Label htmlFor="field-help">Help Text</Label>
                <Textarea
                  id="field-help"
                  value={localField.helpText || ''}
                  onChange={(e) => handleUpdate({ helpText: e.target.value })}
                  data-testid="textarea-field-help"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="field-required"
                  checked={localField.required}
                  onCheckedChange={(checked) => handleUpdate({ required: checked })}
                  data-testid="switch-field-required"
                />
                <Label htmlFor="field-required">Required field</Label>
              </div>
            </div>
          </div>

          {/* Options for select/radio/checkbox */}
          {['select', 'radio', 'checkbox'].includes(localField.fieldType) && (
            <div>
              <h4 className="font-medium mb-3">Options</h4>
              <div className="space-y-3">
                {(localField.options || []).map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Label"
                      value={option.label}
                      onChange={(e) =>
                        updateOption(index, { ...option, label: e.target.value })
                      }
                      data-testid={`input-option-label-${index}`}
                    />
                    <Input
                      placeholder="Value"
                      value={option.value}
                      onChange={(e) =>
                        updateOption(index, { ...option, value: e.target.value })
                      }
                      data-testid={`input-option-value-${index}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removeOption(index)}
                      data-testid={`button-remove-option-${index}`}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addOption}
                  className="w-full"
                  data-testid="button-add-option"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </div>
            </div>
          )}

          {/* Validation Settings */}
          <div>
            <h4 className="font-medium mb-3">Validation</h4>
            <div className="space-y-4">
              {localField.fieldType === 'text' && (
                <>
                  <div>
                    <Label htmlFor="min-length">Minimum Length</Label>
                    <Input
                      id="min-length"
                      type="number"
                      value={localField.validation?.minLength || ''}
                      onChange={(e) =>
                        handleUpdate({
                          validation: {
                            ...localField.validation,
                            minLength: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                      data-testid="input-min-length"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-length">Maximum Length</Label>
                    <Input
                      id="max-length"
                      type="number"
                      value={localField.validation?.maxLength || ''}
                      onChange={(e) =>
                        handleUpdate({
                          validation: {
                            ...localField.validation,
                            maxLength: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                      data-testid="input-max-length"
                    />
                  </div>
                </>
              )}

              {localField.fieldType === 'number' && (
                <>
                  <div>
                    <Label htmlFor="min-value">Minimum Value</Label>
                    <Input
                      id="min-value"
                      type="number"
                      value={localField.validation?.min || ''}
                      onChange={(e) =>
                        handleUpdate({
                          validation: {
                            ...localField.validation,
                            min: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                      data-testid="input-min-value"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-value">Maximum Value</Label>
                    <Input
                      id="max-value"
                      type="number"
                      value={localField.validation?.max || ''}
                      onChange={(e) =>
                        handleUpdate({
                          validation: {
                            ...localField.validation,
                            max: parseInt(e.target.value) || undefined
                          }
                        })
                      }
                      data-testid="input-max-value"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  );
}