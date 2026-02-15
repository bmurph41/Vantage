import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  Presentation,
  ScrollText,
  BookOpen,
  Shield,
  FileSearch,
  Briefcase,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealId: string;
  dealName: string;
}

type DocumentType = 'offering_memorandum' | 'executive_summary' | 'pitch_deck' | 'ic_memo' | 'teaser' | 'lender_package' | 'due_diligence_summary';

interface DocTypeOption {
  key: DocumentType;
  label: string;
  description: string;
  icon: React.ElementType;
  pages: string;
  format: string;
  color: string;
}

const DOC_TYPES: DocTypeOption[] = [
  {
    key: 'executive_summary',
    label: 'Executive Summary',
    description: 'Concise 1-2 page overview of the investment opportunity',
    icon: FileText,
    pages: '1-3 pages',
    format: 'PDF',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
  },
  {
    key: 'teaser',
    label: 'Teaser',
    description: 'Brief marketing document to generate initial interest',
    icon: Zap,
    pages: '1-4 pages',
    format: 'PDF',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  },
  {
    key: 'offering_memorandum',
    label: 'Offering Memorandum',
    description: 'Comprehensive investment package for marketing to buyers',
    icon: BookOpen,
    pages: '20-50 pages',
    format: 'PDF',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30',
  },
  {
    key: 'pitch_deck',
    label: 'Pitch Deck',
    description: 'Visual presentation for meetings and discussions',
    icon: Presentation,
    pages: '10-25 slides',
    format: 'PPTX',
    color: 'text-green-600 bg-green-50 dark:bg-green-950/30',
  },
  {
    key: 'ic_memo',
    label: 'IC Memo',
    description: 'Detailed investment committee memorandum',
    icon: ScrollText,
    pages: '15-30 pages',
    format: 'PDF',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30',
  },
  {
    key: 'lender_package',
    label: 'Lender Package',
    description: 'Documentation package for loan applications',
    icon: Briefcase,
    pages: '20-40 pages',
    format: 'PDF',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    key: 'due_diligence_summary',
    label: 'DD Summary',
    description: 'Summary of due diligence findings and status',
    icon: FileSearch,
    pages: '10-25 pages',
    format: 'DOCX',
    color: 'text-red-600 bg-red-50 dark:bg-red-950/30',
  },
];

type AudiencePersona = 'institutional_investor' | 'private_equity' | 'family_office' | 'lender' | 'investment_committee' | 'board_of_directors' | 'potential_buyer' | 'broker';

const AUDIENCES: { value: AudiencePersona; label: string }[] = [
  { value: 'institutional_investor', label: 'Institutional Investor' },
  { value: 'private_equity', label: 'Private Equity' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'lender', label: 'Lender' },
  { value: 'investment_committee', label: 'Investment Committee' },
  { value: 'board_of_directors', label: 'Board of Directors' },
  { value: 'potential_buyer', label: 'Potential Buyer' },
  { value: 'broker', label: 'Broker' },
];

export default function DocumentGeneratorModal({
  isOpen,
  onClose,
  dealId,
  dealName,
}: DocumentGeneratorModalProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<'select' | 'configure' | 'generating' | 'complete'>('select');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<AudiencePersona | ''>('');
  const [enableAI, setEnableAI] = useState(true);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (params: {
      dealId: string;
      documentType: DocumentType;
      title: string;
      audience?: string;
      enableAI: boolean;
    }) => {
      const res = await apiRequest('POST', '/api/document-builder/auto-generate', params);
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedDocId(data.data?.document?.id || null);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['/api/document-builder/documents'] });
      toast({ title: 'Document Generated', description: `Your ${selectedType?.replace(/_/g, ' ')} has been created.` });
    },
    onError: (error: any) => {
      setStep('configure');
      toast({ title: 'Generation Failed', description: error.message || 'An error occurred while generating the document.', variant: 'destructive' });
    },
  });

  const handleSelectType = (type: DocumentType) => {
    setSelectedType(type);
    const docType = DOC_TYPES.find(d => d.key === type);
    setTitle(`${dealName} - ${docType?.label || type}`);
    setStep('configure');
  };

  const handleGenerate = () => {
    if (!selectedType || !title.trim()) return;
    setStep('generating');
    generateMutation.mutate({
      dealId,
      documentType: selectedType,
      title: title.trim(),
      audience: audience || undefined,
      enableAI,
    });
  };

  const handleOpenInBuilder = () => {
    if (generatedDocId) {
      navigate(`/document-builder/${generatedDocId}`);
    }
    handleClose();
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType(null);
    setTitle('');
    setAudience('');
    setEnableAI(true);
    setGeneratedDocId(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        step === 'select' ? "sm:max-w-2xl" : "sm:max-w-lg"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {step === 'select' && 'Generate Document'}
            {step === 'configure' && 'Configure Document'}
            {step === 'generating' && 'Generating...'}
            {step === 'complete' && 'Document Ready'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && `Auto-generate a document for "${dealName}" using your deal data`}
            {step === 'configure' && 'Customize the document before generating'}
            {step === 'generating' && 'Creating your document with deal data...'}
            {step === 'complete' && 'Your document has been generated and is ready for review'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {DOC_TYPES.map((doc) => {
              const Icon = doc.icon;
              return (
                <button
                  key={doc.key}
                  onClick={() => handleSelectType(doc.key)}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left group"
                >
                  <div className={cn("p-2 rounded-lg shrink-0", doc.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{doc.label}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.description}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{doc.pages}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.format}</Badge>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 'configure' && selectedType && (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-audience">Target Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as AudiencePersona)}>
                <SelectTrigger id="doc-audience">
                  <SelectValue placeholder="Select audience (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium">AI Content Generation</p>
                  <p className="text-xs text-muted-foreground">Auto-generate narratives and descriptions</p>
                </div>
              </div>
              <Switch checked={enableAI} onCheckedChange={setEnableAI} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button onClick={handleGenerate} disabled={!title.trim()} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Document
              </Button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <Sparkles className="h-5 w-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <p className="mt-4 text-sm font-medium">Generating your document...</p>
            <p className="text-xs text-muted-foreground mt-1">Resolving data bindings and creating content</p>
            <div className="mt-6 space-y-2 w-full max-w-xs">
              {['Resolving deal data...', 'Building sections...', enableAI ? 'Generating AI content...' : null].filter(Boolean).map((label, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="rounded-full bg-green-100 dark:bg-green-950/30 p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-semibold">Document Generated</p>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Your {DOC_TYPES.find(d => d.key === selectedType)?.label || 'document'} has been created with your deal data.
            </p>
            <div className="flex gap-2 mt-6 w-full">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
              <Button onClick={handleOpenInBuilder} className="flex-1">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Open in Builder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
