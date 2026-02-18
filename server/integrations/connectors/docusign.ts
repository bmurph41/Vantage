import { BaseConnector, ConnectorConfig, EntitySyncConfig, SyncResult } from './base';

const DOCUSIGN_BASE_URL = 'https://na1.docusign.net/restapi/v2.1';
const DOCUSIGN_DEMO_URL = 'https://demo.docusign.net/restapi/v2.1';

interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
  emailSubject?: string;
  sentDateTime?: string;
  completedDateTime?: string;
  createdDateTime?: string;
  statusChangedDateTime?: string;
  sender?: {
    userName: string;
    email: string;
  };
  recipients?: {
    signers?: DocuSignRecipient[];
    carbonCopies?: DocuSignRecipient[];
  };
}

interface DocuSignRecipient {
  recipientId: string;
  name: string;
  email: string;
  status: string;
  signedDateTime?: string;
  deliveredDateTime?: string;
  routingOrder?: string;
}

interface DocuSignTemplate {
  templateId: string;
  name: string;
  description?: string;
  shared: boolean;
  created?: string;
  lastModified?: string;
  owner?: {
    userName: string;
    email: string;
  };
  folderName?: string;
}

export class DocuSignConnector extends BaseConnector {
  private baseUrl: string;
  private accountId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    const environment = this.getSetting('environment', 'production');
    this.baseUrl = environment === 'demo' ? DOCUSIGN_DEMO_URL : DOCUSIGN_BASE_URL;
    this.accountId = this.getCredential('accountId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ accountId: string; accountName: string; billingPeriodStartDate?: string }>(
        `/accounts/${this.accountId}`
      );

      return {
        connected: true,
        message: `Connected to ${response.accountName || 'DocuSign'}`,
        details: {
          accountId: response.accountId,
          accountName: response.accountName,
        },
      };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      {
        sourceEntity: 'envelopes',
        targetEntity: 'signatureEnvelopes',
        targetModule: 'documents',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'recipients',
        targetEntity: 'signers',
        targetModule: 'documents',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'templates',
        targetEntity: 'signatureTemplates',
        targetModule: 'documents',
        syncDirection: 'read',
        batchSize: 100,
      },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    switch (entityType) {
      case 'envelopes':
        return this.fetchEnvelopes(options);
      case 'templates':
        return this.fetchTemplates(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchEnvelopes(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      count: String(limit),
      start_position: String(offset),
      order_by: 'last_modified',
      order: 'desc',
    };

    if (options?.since) {
      params.from_date = options.since.toISOString();
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      params.from_date = thirtyDaysAgo.toISOString();
    }

    const response = await this.makeAuthenticatedRequest<{
      envelopes: DocuSignEnvelope[];
      totalSetSize: string;
      resultSetSize: string;
    }>(
      `/accounts/${this.accountId}/envelopes`,
      params
    );

    const envelopes = response.envelopes || [];
    const total = parseInt(response.totalSetSize || '0', 10);

    const transformed = envelopes.map(env => ({
      externalId: env.envelopeId,
      status: env.status,
      emailSubject: env.emailSubject,
      sentDateTime: env.sentDateTime,
      completedDateTime: env.completedDateTime,
      createdDateTime: env.createdDateTime,
      senderName: env.sender?.userName,
      senderEmail: env.sender?.email,
      signerCount: env.recipients?.signers?.length || 0,
      integrationSource: 'docusign',
    }));

    return {
      data: transformed,
      hasMore: offset + envelopes.length < total,
      total,
    };
  }

  private async fetchTemplates(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const params: Record<string, string> = {
      count: String(limit),
      start_position: String(offset),
    };

    const response = await this.makeAuthenticatedRequest<{
      envelopeTemplates: DocuSignTemplate[];
      totalSetSize: string;
      resultSetSize: string;
    }>(
      `/accounts/${this.accountId}/templates`,
      params
    );

    const templates = response.envelopeTemplates || [];
    const total = parseInt(response.totalSetSize || '0', 10);

    const transformed = templates.map(tmpl => ({
      externalId: tmpl.templateId,
      name: tmpl.name,
      description: tmpl.description,
      shared: tmpl.shared,
      created: tmpl.created,
      lastModified: tmpl.lastModified,
      ownerName: tmpl.owner?.userName,
      ownerEmail: tmpl.owner?.email,
      folderName: tmpl.folderName,
      integrationSource: 'docusign',
    }));

    return {
      data: transformed,
      hasMore: offset + templates.length < total,
      total,
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'signatureEnvelopes':
        return { created: true, updated: false, id: `envelope_${data.externalId}` };
      case 'signers':
        return { created: true, updated: false, id: `signer_${data.externalId}` };
      case 'signatureTemplates':
        return { created: true, updated: false, id: `template_${data.externalId}` };
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      throw new Error('DocuSign access token expired. Please reconnect.');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DocuSign API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }
}
