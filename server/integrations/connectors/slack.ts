import { BaseConnector, ConnectorConfig, SyncResult } from './base';

const SLACK_API_URL = 'https://slack.com/api';

export class SlackConnector extends BaseConnector {
  private botToken: string;
  private defaultChannelId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.botToken = this.getCredential('botToken');
    this.defaultChannelId = this.getSetting('defaultChannelId', '');
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${SLACK_API_URL}/auth.test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.botToken}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json() as any;
      if (data.ok) {
        return { success: true, message: `Connected as ${data.user} in workspace ${data.team}` };
      }
      return { success: false, message: data.error || 'Authentication failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /** Send a notification message to a Slack channel */
  async sendNotification(params: {
    channel?: string;
    text: string;
    blocks?: any[];
    threadTs?: string;
  }): Promise<{ ok: boolean; ts?: string }> {
    const res = await fetch(`${SLACK_API_URL}/chat.postMessage`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.botToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: params.channel || this.defaultChannelId,
        text: params.text,
        blocks: params.blocks,
        thread_ts: params.threadTs,
      }),
    });
    return res.json() as any;
  }

  /** Send a deal alert to Slack */
  async sendDealAlert(deal: { title: string; stage: string; value: number; url: string }): Promise<void> {
    await this.sendNotification({
      text: `Deal Update: ${deal.title}`,
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: `Deal: ${deal.title}` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Stage:* ${deal.stage}` },
          { type: 'mrkdwn', text: `*Value:* $${deal.value?.toLocaleString() || 'N/A'}` },
        ]},
        { type: 'actions', elements: [
          { type: 'button', text: { type: 'plain_text', text: 'View Deal' }, url: deal.url, style: 'primary' },
        ]},
      ],
    });
  }

  /** List channels the bot has access to */
  async listChannels(): Promise<{ id: string; name: string }[]> {
    const res = await fetch(`${SLACK_API_URL}/conversations.list?types=public_channel,private_channel&limit=200`, {
      headers: { 'Authorization': `Bearer ${this.botToken}` },
    });
    const data = await res.json() as any;
    return (data.channels || []).map((c: any) => ({ id: c.id, name: c.name }));
  }

  async syncAll(): Promise<SyncResult> {
    // Slack is notification-only, no data sync
    return { success: true, recordsProcessed: 0, recordsFailed: 0, errors: [] };
  }
}
