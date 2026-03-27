import { BaseConnector, ConnectorConfig, SyncResult } from './base';

export class MailchimpConnector extends BaseConnector {
  private apiKey: string;
  private server: string; // datacenter prefix (e.g., "us21")
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiKey = this.getCredential('apiKey');
    // Mailchimp API keys end with -usXX which indicates the datacenter
    this.server = this.apiKey?.split('-').pop() || this.getSetting('server', 'us21');
    this.baseUrl = `https://${this.server}.api.mailchimp.com/3.0`;
  }

  private headers() {
    return {
      'Authorization': `apikey ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/ping`, { headers: this.headers() });
      const data = await res.json() as any;
      if (data.health_status === "Everything's Chimpy!") {
        return { success: true, message: `Connected to Mailchimp (${this.server})` };
      }
      return { success: false, message: data.detail || 'Connection failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /** List all audiences (mailing lists) */
  async listAudiences(): Promise<{ id: string; name: string; memberCount: number }[]> {
    const res = await fetch(`${this.baseUrl}/lists?count=100`, { headers: this.headers() });
    const data = await res.json() as any;
    return (data.lists || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      memberCount: l.stats?.member_count || 0,
    }));
  }

  /** Add or update a contact in an audience */
  async upsertContact(audienceId: string, contact: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    tags?: string[];
    mergeFields?: Record<string, string>;
  }): Promise<{ id: string; status: string }> {
    const subscriberHash = await this.md5(contact.email.toLowerCase());
    const res = await fetch(`${this.baseUrl}/lists/${audienceId}/members/${subscriberHash}`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify({
        email_address: contact.email,
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: contact.firstName || '',
          LNAME: contact.lastName || '',
          COMPANY: contact.company || '',
          ...contact.mergeFields,
        },
        tags: contact.tags?.map(t => ({ name: t, status: 'active' })),
      }),
    });
    const data = await res.json() as any;
    return { id: data.id, status: data.status };
  }

  /** Sync CRM contacts to a Mailchimp audience */
  async syncContactsToAudience(audienceId: string, contacts: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    tags?: string[];
  }[]): Promise<SyncResult> {
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Use batch operations for efficiency
    const operations = contacts.map(c => ({
      method: 'PUT',
      path: `/lists/${audienceId}/members/${this.md5Sync(c.email.toLowerCase())}`,
      body: JSON.stringify({
        email_address: c.email,
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: c.firstName || '',
          LNAME: c.lastName || '',
          COMPANY: c.company || '',
        },
      }),
    }));

    // Batch in groups of 500 (Mailchimp limit)
    for (let i = 0; i < operations.length; i += 500) {
      const batch = operations.slice(i, i + 500);
      try {
        const res = await fetch(`${this.baseUrl}/batches`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ operations: batch }),
        });
        if (res.ok) {
          processed += batch.length;
        } else {
          failed += batch.length;
          errors.push(`Batch ${i / 500 + 1} failed: ${res.status}`);
        }
      } catch (error: any) {
        failed += batch.length;
        errors.push(error.message);
      }
    }

    return { success: failed === 0, recordsProcessed: processed, recordsFailed: failed, errors };
  }

  /** Create a campaign */
  async createCampaign(params: {
    audienceId: string;
    subject: string;
    fromName: string;
    replyTo: string;
    templateId?: number;
  }): Promise<{ id: string; webId: number }> {
    const res = await fetch(`${this.baseUrl}/campaigns`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        type: 'regular',
        recipients: { list_id: params.audienceId },
        settings: {
          subject_line: params.subject,
          from_name: params.fromName,
          reply_to: params.replyTo,
          template_id: params.templateId,
        },
      }),
    });
    const data = await res.json() as any;
    return { id: data.id, webId: data.web_id };
  }

  async syncAll(): Promise<SyncResult> {
    // Full CRM → Mailchimp contact sync can be implemented per org settings
    return { success: true, recordsProcessed: 0, recordsFailed: 0, errors: [] };
  }

  private md5Sync(input: string): string {
    // Simple hash for subscriber identification — in production use crypto.createHash
    const { createHash } = require('crypto');
    return createHash('md5').update(input).digest('hex');
  }

  private async md5(input: string): Promise<string> {
    return this.md5Sync(input);
  }
}
