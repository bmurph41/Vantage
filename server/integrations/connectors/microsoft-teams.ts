import { BaseConnector, ConnectorConfig, SyncResult } from './base';

const GRAPH_API_URL = 'https://graph.microsoft.com/v1.0';

export class MicrosoftTeamsConnector extends BaseConnector {
  private accessToken: string;
  private webhookUrl: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.accessToken = this.getCredential('accessToken');
    this.webhookUrl = this.getSetting('webhookUrl', '');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    // Test via incoming webhook if configured
    if (this.webhookUrl) {
      try {
        const res = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            '@context': 'http://schema.org/extensions',
            summary: 'MarinaMatch Connection Test',
            text: 'MarinaMatch is successfully connected to Microsoft Teams.',
          }),
        });
        return res.ok
          ? { success: true, message: 'Webhook connected successfully' }
          : { success: false, message: `Webhook returned ${res.status}` };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }

    // Test via Graph API if OAuth token configured
    if (this.accessToken) {
      try {
        const res = await fetch(`${GRAPH_API_URL}/me`, {
          headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });
        const data = await res.json() as any;
        return res.ok
          ? { success: true, message: `Connected as ${data.displayName}` }
          : { success: false, message: data.error?.message || 'Auth failed' };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }

    return { success: false, message: 'No webhook URL or access token configured' };
  }

  /** Send a notification via incoming webhook */
  async sendWebhookNotification(params: {
    title: string;
    text: string;
    themeColor?: string;
    sections?: any[];
    actions?: any[];
  }): Promise<boolean> {
    if (!this.webhookUrl) return false;

    const card: any = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: params.themeColor || '1B365D',
      summary: params.title,
      sections: [
        {
          activityTitle: params.title,
          text: params.text,
          ...(params.sections ? { facts: params.sections } : {}),
        },
      ],
    };

    if (params.actions) {
      card.potentialAction = params.actions;
    }

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    return res.ok;
  }

  /** Send a deal alert to Teams */
  async sendDealAlert(deal: { title: string; stage: string; value: number; url: string }): Promise<void> {
    await this.sendWebhookNotification({
      title: `Deal Update: ${deal.title}`,
      text: `Stage moved to **${deal.stage}**`,
      sections: [
        { name: 'Deal Value', value: `$${deal.value?.toLocaleString() || 'N/A'}` },
        { name: 'Stage', value: deal.stage },
      ],
      actions: [{
        '@type': 'OpenUri',
        name: 'View in MarinaMatch',
        targets: [{ os: 'default', uri: deal.url }],
      }],
    });
  }

  /** Send a message to a Teams channel via Graph API */
  async sendChannelMessage(teamId: string, channelId: string, content: string): Promise<any> {
    if (!this.accessToken) return null;

    const res = await fetch(`${GRAPH_API_URL}/teams/${teamId}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: { contentType: 'html', content },
      }),
    });

    return res.json();
  }

  async syncAll(): Promise<SyncResult> {
    return { success: true, recordsProcessed: 0, recordsFailed: 0, errors: [] };
  }
}
