import { BaseConnector, ConnectorConfig, SyncResult } from './base';

const CC_API_URL = 'https://api.cc.email/v3';

export class ConstantContactConnector extends BaseConnector {
  private accessToken: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.accessToken = this.getCredential('accessToken');
  }

  private headers() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${CC_API_URL}/account/summary`, { headers: this.headers() });
      const data = await res.json() as any;
      if (res.ok) {
        return { success: true, message: `Connected: ${data.organization_name || data.first_name || 'OK'}` };
      }
      return { success: false, message: data.error_message || `HTTP ${res.status}` };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /** List all contact lists */
  async listContactLists(): Promise<{ id: string; name: string; memberCount: number }[]> {
    const res = await fetch(`${CC_API_URL}/contact_lists?include_count=true`, { headers: this.headers() });
    const data = await res.json() as any;
    return (data.lists || []).map((l: any) => ({
      id: l.list_id,
      name: l.name,
      memberCount: l.membership_count || 0,
    }));
  }

  /** Create or update a contact */
  async upsertContact(contact: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
    listIds?: string[];
  }): Promise<{ contactId: string; action: string }> {
    const res = await fetch(`${CC_API_URL}/contacts/sign_up_form`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        email_address: { address: contact.email, permission_to_send: 'implicit' },
        first_name: contact.firstName || '',
        last_name: contact.lastName || '',
        company_name: contact.company || '',
        phone_numbers: contact.phone ? [{ phone_number: contact.phone, kind: 'other' }] : [],
        list_memberships: contact.listIds || [],
        create_source: 'Account',
      }),
    });
    const data = await res.json() as any;
    return {
      contactId: data.contact_id || '',
      action: data.action || (res.status === 201 ? 'created' : 'updated'),
    };
  }

  /** Sync CRM contacts to a Constant Contact list */
  async syncContactsToList(listId: string, contacts: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
  }[]): Promise<SyncResult> {
    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Constant Contact supports bulk import
    const importData = contacts.map(c => ({
      email: { address: c.email },
      first_name: c.firstName || '',
      last_name: c.lastName || '',
      company_name: c.company || '',
    }));

    // Batch in groups of 500
    for (let i = 0; i < importData.length; i += 500) {
      const batch = importData.slice(i, i + 500);
      try {
        const res = await fetch(`${CC_API_URL}/activities/contacts_json_import`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            import_data: batch,
            list_ids: [listId],
          }),
        });
        if (res.ok) {
          processed += batch.length;
        } else {
          const err = await res.json() as any;
          failed += batch.length;
          errors.push(err.error_message || `Batch failed: ${res.status}`);
        }
      } catch (error: any) {
        failed += batch.length;
        errors.push(error.message);
      }
    }

    return { success: failed === 0, recordsProcessed: processed, recordsFailed: failed, errors };
  }

  /** Create an email campaign */
  async createCampaign(params: {
    name: string;
    subject: string;
    fromEmail: string;
    fromName: string;
    htmlContent: string;
    listIds: string[];
  }): Promise<{ campaignId: string }> {
    // Step 1: Create campaign
    const campaignRes = await fetch(`${CC_API_URL}/emails`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        name: params.name,
        email_campaign_activities: [{
          format_type: 5, // Custom HTML
          from_email: params.fromEmail,
          from_name: params.fromName,
          subject: params.subject,
          html_content: params.htmlContent,
          contact_list_ids: params.listIds,
        }],
      }),
    });
    const campaign = await campaignRes.json() as any;
    return { campaignId: campaign.campaign_id || '' };
  }

  async syncAll(): Promise<SyncResult> {
    return { success: true, recordsProcessed: 0, recordsFailed: 0, errors: [] };
  }
}
