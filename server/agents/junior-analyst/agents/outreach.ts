import { BaseAgent } from '../base-agent';
import { jaBus } from '../event-bus';
import Anthropic from '@anthropic-ai/sdk';

export class OutreachAgent extends BaseAgent {
  readonly id = 'outreach' as const;
  readonly name = 'Outreach';

  register(): void {
    jaBus.on('deal:created', async (payload) => {
      try {
        if (!await this.isEnabled(payload.orgId)) return;
        const mode = await this.getMode(payload.orgId);
        if (mode !== 'assisted') return;

        const isProspect = ['prospect', 'lead', 'new', 'identified'].some(s =>
          payload.stage?.toLowerCase().includes(s)
        );
        if (!isProspect) return;

        const draft = await this.draftOutreach(payload);

        await this.createSuggestion({
          orgId: payload.orgId,
          dealId: payload.dealId,
          agentId: this.id,
          agentName: this.name,
          type: 'outreach_draft',
          title: `Outreach drafted for ${payload.dealName}`,
          body: draft,
          data: { dealId: payload.dealId, dealName: payload.dealName, address: payload.address },
          priority: 'low',
          triggeredBy: 'deal:created',
        });
      } catch (err) {
        this.error('Failed to draft outreach', err);
      }
    });

    this.log('Registered (deal:created)');
  }

  private async draftOutreach(payload: { dealName: string; address?: string; assetClass?: string }): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return this.fallbackDraft(payload);
    }

    try {
      const client = new Anthropic({ apiKey });
      const prompt = `You are a professional marina acquisition specialist. Draft a brief, professional cold outreach email to the owner of a marina${payload.address ? ` located at ${payload.address}` : ''}. 

The email should:
- Be 3–4 short paragraphs
- Express genuine interest in their property
- Not disclose the specific acquisition price target
- Sound personal, not templated
- End with a soft call to action (a brief call or site visit)

Return ONLY the email body text, no subject line, no markdown formatting.`;

      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
      return text || this.fallbackDraft(payload);
    } catch (err) {
      this.error('AI outreach draft failed, using fallback', err);
      return this.fallbackDraft(payload);
    }
  }

  private fallbackDraft(payload: { dealName: string; address?: string }): string {
    return `I wanted to reach out regarding your marina${payload.address ? ` at ${payload.address}` : ''}. Our firm specializes in marina acquisitions and we've been actively looking at opportunities in your area.\n\nWe take a long-term ownership approach and work closely with existing operators to maintain and grow what they've built. If you've ever thought about a transition — whether that's a full sale, partial recapitalization, or simply exploring your options — we'd love to have a conversation.\n\nWould you be open to a brief call at your convenience? No pressure, just an introduction.`;
  }
}
