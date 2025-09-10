import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Mail, Phone, User, Calendar, MapPin, ExternalLink } from "lucide-react";
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
  };
  relatedProjects: Array<{
    project: Project;
    tasks: Task[];
  }>;
}

export function CompanyDetailsModal({ 
  isOpen, 
  onClose, 
  companyName, 
  contactInfo,
  relatedProjects 
}: CompanyDetailsModalProps) {
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
            <div className="flex items-center space-x-2 mb-4">
              <User className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            </div>
            
            {(contactInfo.repName || contactInfo.repEmail || contactInfo.repPhone) ? (
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
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No contact information available for this company</p>
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