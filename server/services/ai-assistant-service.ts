import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AssistantContext {
  currentPage: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  userId?: string;
  orgId?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const PLATFORM_KNOWLEDGE = `
You are MarinaMatch AI Assistant, a helpful guide for users navigating the MarinaMatch platform - an institutional-grade marina acquisition and management system.

## Platform Overview
MarinaMatch helps institutional investors and marina operators manage the entire lifecycle of marina acquisitions:
- **CRM Module**: Track deals, leads, contacts, companies, and properties
- **Due Diligence (DD)**: Manage DD projects with tasks, timelines, and document tracking
- **Modeling Projects**: Financial modeling for marina valuations with exit strategies, cap rates, and scenario analysis
- **Rent Roll**: Track marina tenants, leases, slip assignments, and occupancy
- **Sales Comps**: Compare marina sales data for valuation analysis
- **DockTalk**: Industry intelligence and news aggregation
- **Virtual Data Room (VDR)**: Secure document storage with granular permissions

## Key Features by Module

### CRM
- Deals progress through pipeline stages (Lead → Qualified → Proposal → Negotiation → Closed)
- Track activities, meetings, and communications
- Link contacts to companies and properties
- Property status tracking and ownership history

### Due Diligence
- Create DD projects from deals
- Track tasks with deadlines and assignees
- Monitor DD period expiration
- Manage document requests and deliverables

### Modeling Projects
- Multi-case scenario modeling (Base, Upside, Downside)
- Exit strategy calculations with IRR and equity multiples
- Addbacks system for EBITDA normalization
- Capital stack builder for financing structures
- Pro forma projections

### Rent Roll
- Tenant management with lease tracking
- Slip assignments and storage locations
- Occupancy analytics by contract type
- Move-in/move-out event tracking

### Analytics Dashboard
- Unified cross-module analytics
- Pipeline value tracking
- DD completion rates
- Trend visualization

## Your Role
- Help users understand features and navigate the platform
- Explain financial concepts relevant to marina acquisitions
- Guide users through workflows step-by-step
- Answer questions about data they're viewing
- Provide best practices for marina due diligence

## Response Style
- Be concise but thorough
- Use bullet points for multi-step instructions
- Explain marina-specific terminology when needed
- If asked about specific data, explain where to find it
- If you don't know something specific to their data, acknowledge it and explain what you can help with
`;

const PAGE_CONTEXT_PROMPTS: Record<string, string> = {
  '/': 'User is on the Dashboard viewing key metrics and quick access items.',
  '/crm': 'User is in the CRM module. They can manage deals, contacts, companies, and properties here.',
  '/crm/deals': 'User is viewing the Deals list. Deals represent potential or active marina acquisitions.',
  '/crm/contacts': 'User is viewing Contacts. These are people associated with deals, properties, or companies.',
  '/crm/companies': 'User is viewing Companies. These are organizations involved in marina transactions.',
  '/crm/properties': 'User is viewing Properties. These represent marina properties being tracked.',
  '/crm/pipeline': 'User is viewing the Pipeline board. This shows deals organized by stage.',
  '/dd': 'User is in the Due Diligence module for managing DD projects.',
  '/dd/projects': 'User is viewing Due Diligence projects list.',
  '/modeling': 'User is in the Modeling module for financial analysis and valuation.',
  '/rent-roll': 'User is in the Rent Roll module for managing marina tenants and leases.',
  '/sales-comps': 'User is in Sales Comps for marina transaction comparables analysis.',
  '/docktalk': 'User is in DockTalk for industry news and intelligence.',
  '/vdr': 'User is in the Virtual Data Room for secure document management.',
  '/analytics': 'User is viewing Analytics for cross-module insights and trends.',
};

function getContextPrompt(context: AssistantContext): string {
  let prompt = '';
  
  const pageContext = Object.entries(PAGE_CONTEXT_PROMPTS).find(([path]) => 
    context.currentPage.startsWith(path) && path !== '/'
  );
  
  if (pageContext) {
    prompt += `\n\nCurrent Context: ${pageContext[1]}`;
  } else if (context.currentPage === '/') {
    prompt += `\n\nCurrent Context: ${PAGE_CONTEXT_PROMPTS['/']}`;
  }
  
  if (context.entityType && context.entityName) {
    prompt += `\nViewing: ${context.entityType} - "${context.entityName}"`;
  }
  
  return prompt;
}

export async function chat(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): Promise<string> {
  const systemPrompt = PLATFORM_KNOWLEDGE + getContextPrompt(context);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
      max_completion_tokens: 1024,
    });
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (error: any) {
    console.error('[AI Assistant] Error:', error);
    throw new Error('Failed to get AI response: ' + error.message);
  }
}

export async function* chatStream(
  userMessage: string,
  context: AssistantContext,
  conversationHistory: ConversationMessage[] = []
): AsyncGenerator<string> {
  const systemPrompt = PLATFORM_KNOWLEDGE + getContextPrompt(context);
  
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];
  
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
      max_completion_tokens: 1024,
      stream: true,
    });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error: any) {
    console.error('[AI Assistant] Stream error:', error);
    throw new Error('Failed to stream AI response: ' + error.message);
  }
}

export function getSuggestedQuestions(currentPage: string): string[] {
  const baseQuestions = [
    "What can I do in this section?",
    "How do I get started?",
  ];
  
  const pageQuestions: Record<string, string[]> = {
    '/': [
      "What metrics should I focus on?",
      "How do I create a new deal?",
      "Explain the pipeline stages",
    ],
    '/crm': [
      "How do I add a new contact?",
      "What's the difference between deals and leads?",
      "How do I link a contact to a property?",
    ],
    '/crm/deals': [
      "How do I move a deal to the next stage?",
      "What fields are required for a deal?",
      "How do I convert a deal to a DD project?",
    ],
    '/modeling': [
      "How do I create a valuation model?",
      "What are exit strategies?",
      "Explain cap rate calculation",
      "What are addbacks in EBITDA?",
    ],
    '/dd': [
      "How do I track DD tasks?",
      "What's a typical DD timeline?",
      "How do I manage document requests?",
    ],
    '/rent-roll': [
      "How do I add a new tenant?",
      "What's the difference between annual and seasonal leases?",
      "How do I track occupancy?",
    ],
    '/sales-comps': [
      "How do I import sales comparables?",
      "What metrics matter for marina valuations?",
      "How do I filter comps by region?",
    ],
  };
  
  const matchedPath = Object.keys(pageQuestions).find(path => 
    currentPage.startsWith(path) && path !== '/'
  ) || (currentPage === '/' ? '/' : null);
  
  if (matchedPath && pageQuestions[matchedPath]) {
    return [...pageQuestions[matchedPath], ...baseQuestions].slice(0, 5);
  }
  
  return baseQuestions;
}
