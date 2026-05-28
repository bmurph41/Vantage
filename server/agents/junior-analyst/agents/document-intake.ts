import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';
import Anthropic from '@anthropic-ai/sdk';

export class DocumentIntakeAgent extends BaseAgent {
  readonly id = 'document_intake' as const;
  readonly name = 'Document Intake';

  register(): void {
    jaBus.on('doc:uploaded', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId, payload.projectId)) return;
        const mode = await this.getMode(payload.orgId, payload.projectId);

        const ext = payload.filename.split('.').pop()?.toLowerCase() ?? '';
        const detectedType = payload.docType ?? this.inferDocType(payload.filename);
        const canAutoParse = ['xlsx', 'xls', 'xlsm', 'csv'].includes(ext);

        if (mode === 'assisted') {
          await this.createSuggestion({
            orgId: payload.orgId,
            projectId: payload.projectId,
            agentId: this.id,
            agentName: this.name,
            type: 'document_routed',
            title: `New upload ready: ${payload.filename}`,
            body: `I detected this as a **${detectedType}** document.${canAutoParse ? ' It\'s ready to parse — I can kick off extraction now.' : ' This format may need manual review before parsing.'}`,
            data: { uploadId: payload.uploadId, filename: payload.filename, detectedType, canAutoParse, ext },
            priority: 'normal',
            triggeredBy: 'doc:uploaded',
          });
        } else {
          this.log(`Manual mode — doc uploaded: ${payload.filename} (${detectedType})`);
        }
      } catch (err) {
        this.error('Failed to handle doc:uploaded', err);
      }
    });

    jaBus.on('doc:parsed', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId, payload.projectId)) return;
        const mode = await this.getMode(payload.orgId, payload.projectId);
        if (mode !== 'assisted') return;

        const confPct = payload.itemCount > 0
          ? Math.round((payload.highConfidence / payload.itemCount) * 100)
          : 0;

        const priority = confPct >= 80 ? 'normal' : confPct >= 60 ? 'high' : 'critical';

        await this.createSuggestion({
          orgId: payload.orgId,
          projectId: payload.projectId,
          agentId: this.id,
          agentName: this.name,
          type: 'parse_complete',
          title: `Extraction complete — ${confPct}% auto-mapped`,
          body: `Extracted **${payload.itemCount} line items**, with ${payload.highConfidence} mapped automatically (${confPct}% confidence).${confPct < 80 ? ' A manual review pass is recommended on the low-confidence items.' : ' Ready for your sign-off.'}`,
          data: { uploadId: payload.uploadId, itemCount: payload.itemCount, highConfidence: payload.highConfidence, confPct },
          priority,
          triggeredBy: 'doc:parsed',
        });
      } catch (err) {
        this.error('Failed to handle doc:parsed', err);
      }
    });

    this.log('Registered (doc:uploaded, doc:parsed)');
  }

  private inferDocType(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('rent') || lower.includes('roll') || lower.includes('unit')) return 'Rent Roll';
    if (lower.includes('p&l') || lower.includes('pnl') || lower.includes('profit') || lower.includes('income') || lower.includes('financial')) return 'P&L Statement';
    if (lower.includes('t12') || lower.includes('trailing')) return 'T-12';
    if (lower.includes('loi') || lower.includes('letter of intent')) return 'LOI';
    if (lower.includes('psa') || lower.includes('purchase')) return 'PSA';
    if (lower.includes('tax') || lower.includes('return')) return 'Tax Return';
    if (lower.includes('survey') || lower.includes('appraisal')) return 'Appraisal';
    return 'Financial Document';
  }
}
