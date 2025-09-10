import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Phone, User, Calendar, MapPin, ExternalLink, Edit2, Save, X } from "lucide-react";
import { formatPhoneNumber } from "@/lib/phone-utils";
import type { Task, Project } from "@shared/schema";
import { format } from "date-fns";

interface CompanyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyName: string;
  contactInfo: {
    repName?: string;
    repEmail?: string;
    repPhone?: string;
    companyAddress?: string;
    companyCity?: string;
    companyState?: string;
    companyZip?: string;
  };
  relatedProjects: Array<{
    project: Project;
    tasks: Task[];
  }>;
  onContactInfoUpdate?: (contactInfo: {
    repName?: string;
    repEmail?: string;
    repPhone?: string;
    companyAddress?: string;
    companyCity?: string;
    companyState?: string;
    companyZip?: string;
  }) => Promise<void>;
}

export function CompanyDetailsModal({ 
  isOpen, 
  onClose, 
  companyName, 
  contactInfo,
  relatedProjects,
  onContactInfoUpdate 
}: CompanyDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContactInfo, setEditedContactInfo] = useState(contactInfo);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Update local state when props change
  React.useEffect(() => {
    setEditedContactInfo(contactInfo);
  }, [contactInfo]);

  const handleSave = async () => {
    if (!onContactInfoUpdate) return;
    
    setIsSaving(true);
    try {
      await onContactInfoUpdate(editedContactInfo);
      setIsEditing(false);
      toast({
        title: "Contact information updated",
        description: `Updated contact details for ${companyName}`,
      });
    } catch (error) {
      toast({
        title: "Error updating contact information",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContactInfo(contactInfo);
    setIsEditing(false);
  };
  const totalTasksWithCompany = relatedProjects.reduce((sum, proj) => sum + proj.tasks.length, 0);
  const completedTasks = relatedProjects.reduce((sum, proj) => 
    sum + proj.tasks.filter(task => task.status === 'completed').length, 0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center space-x-3 text-xl font-semibold">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <span className="text-gray-900">{companyName}</span>
              <p className="text-sm text-gray-500 font-normal mt-1">Company Details & Project History</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Information Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
              </div>
              {!isEditing && onContactInfoUpdate && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-1"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>Edit</span>
                </Button>
              )}
              {isEditing && (
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex items-center space-x-1"
                  >
                    <X className="h-3 w-3" />
                    <span>Cancel</span>
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center space-x-1"
                  >
                    <Save className="h-3 w-3" />
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                  </Button>
                </div>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rep-name" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Representative Name
                    </Label>
                    <Input
                      id="rep-name"
                      value={editedContactInfo.repName || ''}
                      onChange={(e) => setEditedContactInfo(prev => ({ ...prev, repName: e.target.value }))}
                      placeholder="Enter representative name"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rep-email" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Email Address
                    </Label>
                    <Input
                      id="rep-email"
                      type="email"
                      value={editedContactInfo.repEmail || ''}
                      onChange={(e) => setEditedContactInfo(prev => ({ ...prev, repEmail: e.target.value }))}
                      placeholder="Enter email address"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="rep-phone" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Phone Number
                    </Label>
                    <Input
                      id="rep-phone"
                      type="tel"
                      value={editedContactInfo.repPhone || ''}
                      onChange={(e) => setEditedContactInfo(prev => ({ ...prev, repPhone: e.target.value }))}
                      onBlur={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setEditedContactInfo(prev => ({ ...prev, repPhone: formatted }));
                      }}
                      placeholder="Enter phone number"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company-address" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Street Address
                    </Label>
                    <Input
                      id="company-address"
                      value={editedContactInfo.companyAddress || ''}
                      onChange={(e) => setEditedContactInfo(prev => ({ ...prev, companyAddress: e.target.value }))}
                      placeholder="123 Main Street"
                      className="text-sm"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="company-city" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        City
                      </Label>
                      <Input
                        id="company-city"
                        value={editedContactInfo.companyCity || ''}
                        onChange={(e) => setEditedContactInfo(prev => ({ ...prev, companyCity: e.target.value }))}
                        placeholder="City"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="company-state" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          State
                        </Label>
                        <Input
                          id="company-state"
                          value={editedContactInfo.companyState || ''}
                          onChange={(e) => setEditedContactInfo(prev => ({ ...prev, companyState: e.target.value }))}
                          placeholder="State"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-zip" className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          ZIP Code
                        </Label>
                        <Input
                          id="company-zip"
                          value={editedContactInfo.companyZip || ''}
                          onChange={(e) => setEditedContactInfo(prev => ({ ...prev, companyZip: e.target.value }))}
                          placeholder="12345"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {(contactInfo.repName || contactInfo.repEmail || contactInfo.repPhone || contactInfo.companyAddress || contactInfo.companyCity || contactInfo.companyState || contactInfo.companyZip) ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {contactInfo.repName && (
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-md border">
                        <User className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Representative</p>
                          <p className="text-sm font-medium text-gray-900">{contactInfo.repName}</p>
                        </div>
                      </div>
                    )}
                    
                    {contactInfo.repEmail && (
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-md border">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</p>
                          <a 
                            href={`mailto:${contactInfo.repEmail}`} 
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {contactInfo.repEmail}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {contactInfo.repPhone && (
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-md border">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</p>
                          <a 
                            href={`tel:${contactInfo.repPhone}`} 
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {contactInfo.repPhone}
                          </a>
                        </div>
                      </div>
                    )}
                    
                    {/* Address Display */}
                    {(contactInfo.companyAddress || contactInfo.companyCity || contactInfo.companyState || contactInfo.companyZip) && (
                      <div className="flex items-start space-x-3 p-3 bg-white rounded-md border">
                        <MapPin className="h-4 w-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Address</p>
                          <div className="text-sm font-medium text-gray-900">
                            {contactInfo.companyAddress && (
                              <div>{contactInfo.companyAddress}</div>
                            )}
                            {(contactInfo.companyCity || contactInfo.companyState || contactInfo.companyZip) && (
                              <div>
                                {contactInfo.companyCity}
                                {contactInfo.companyCity && contactInfo.companyState && ', '}
                                {contactInfo.companyState}
                                {contactInfo.companyZip && ` ${contactInfo.companyZip}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No contact information available for this company</p>
                    {onContactInfoUpdate && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsEditing(true)}
                        className="mt-3"
                      >
                        Add Contact Information
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Company Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">{relatedProjects.length}</div>
              <div className="text-sm font-medium text-blue-800">Projects</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center border border-green-200">
              <div className="text-2xl font-bold text-green-600">{totalTasksWithCompany}</div>
              <div className="text-sm font-medium text-green-800">Total Tasks</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center border border-purple-200">
              <div className="text-2xl font-bold text-purple-600">{completedTasks}</div>
              <div className="text-sm font-medium text-purple-800">Completed</div>
            </div>
          </div>

          <Separator />

          {/* Project History Section */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Project History</h3>
              <Badge variant="secondary" className="text-xs">
                {relatedProjects.length} {relatedProjects.length === 1 ? 'Project' : 'Projects'}
              </Badge>
            </div>
            
            {relatedProjects.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {relatedProjects.map(({ project, tasks }) => (
                  <div key={project.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">{project.name}</h4>
                        {project.description && (
                          <div className="text-sm text-gray-600 mb-2">
                            <span>{project.description}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant="default"
                          className="text-xs"
                        >
                          Active
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {project.psaSignedDate && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">PSA Signed</p>
                          <p className="text-gray-900">{format(new Date(project.psaSignedDate), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      {project.ddExpirationDate && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">DD Expiration</p>
                          <p className="text-gray-900">{format(new Date(project.ddExpirationDate), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Tasks</p>
                        <p className="text-gray-900">{tasks.length}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Completed</p>
                        <p className="text-green-600 font-medium">
                          {tasks.filter(t => t.status === 'completed').length}
                        </p>
                      </div>
                    </div>
                    
                    {tasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tasks with {companyName}</p>
                        <div className="space-y-1">
                          {tasks.slice(0, 3).map(task => (
                            <div key={task.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 truncate">{task.title}</span>
                              <Badge 
                                variant={task.status === 'completed' ? 'default' : 'secondary'}
                                className="text-xs ml-2"
                              >
                                {task.status}
                              </Badge>
                            </div>
                          ))}
                          {tasks.length > 3 && (
                            <p className="text-xs text-gray-500 italic">+{tasks.length - 3} more tasks</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No project history found for this company</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <Button onClick={onClose} className="px-6">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}