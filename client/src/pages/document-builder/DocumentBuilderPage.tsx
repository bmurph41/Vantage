/**
 * Document Builder Page
 * Main page for the Document Builder wizard (wouter-compatible)
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ArrowLeft } from 'lucide-react';
import { DocumentBuilder } from '../../components/document-builder/DocumentBuilder';
import { useDocumentBuilderStore } from '../../stores/document-builder-store';
import {
  useDocumentTypeConfigs,
  useSectionLibrary,
} from '../../lib/document-builder-api';

interface DocumentBuilderPageProps {
  documentId?: string;
}

export default function DocumentBuilderPage({ documentId }: DocumentBuilderPageProps) {
  const [, navigate] = useLocation();
  
  const {
    setBuilderMode,
    setSectionLibrary,
    setDocumentTypeConfigs,
    reset,
  } = useDocumentBuilderStore();

  const { data: documentTypeConfigs, isLoading: configsLoading } = useDocumentTypeConfigs();
  const { data: sectionLibrary, isLoading: libraryLoading } = useSectionLibrary();

  const isLoading = configsLoading || libraryLoading;

  // Initialize builder mode
  useEffect(() => {
    setBuilderMode(true);
    return () => {
      setBuilderMode(false);
      reset();
    };
  }, [setBuilderMode, reset]);

  // Load document type configs
  useEffect(() => {
    if (documentTypeConfigs?.data) {
      setDocumentTypeConfigs(documentTypeConfigs.data);
    }
  }, [documentTypeConfigs, setDocumentTypeConfigs]);

  // Load section library
  useEffect(() => {
    if (sectionLibrary?.data) {
      setSectionLibrary(sectionLibrary.data);
    }
  }, [sectionLibrary, setSectionLibrary]);

  const handleComplete = () => {
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <div className="space-y-6">
          <Skeleton className="h-12 w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <FileText className="h-8 w-8 text-[#1E4FAB]" />
              Document Builder
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Create professional documents with AI-powered content generation
            </p>
          </div>
        </div>

        {/* Main Builder Component */}
        <DocumentBuilder
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
