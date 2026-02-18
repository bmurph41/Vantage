import { BaseConnector, ConnectorConfig, EntitySyncConfig, SyncResult } from './base';

const INTACCT_API_URL = 'https://api.intacct.com/ia/xml/xmlgw.phtml';

interface IntacctGLAccount {
  RECORDNO: string;
  ACCOUNTNO: string;
  TITLE: string;
  ACCOUNTTYPE: string;
  NORMALBALANCE: string;
  STATUS: string;
  CATEGORY?: string;
  DEPARTMENTID?: string;
}

interface IntacctGLEntry {
  RECORDNO: string;
  BATCH_DATE: string;
  BATCH_TITLE?: string;
  ACCOUNTNO: string;
  DEBIT?: number;
  CREDIT?: number;
  DESCRIPTION?: string;
  DEPARTMENTID?: string;
  LOCATIONID?: string;
  WHENCREATED?: string;
}

interface IntacctAPBill {
  RECORDNO: string;
  VENDORID: string;
  VENDORNAME?: string;
  TOTALDUE: number;
  TOTALPAID?: number;
  WHENDUE?: string;
  WHENCREATED?: string;
  STATE: string;
  DESCRIPTION?: string;
  BILLNO?: string;
}

interface IntacctARInvoice {
  RECORDNO: string;
  CUSTOMERID: string;
  CUSTOMERNAME?: string;
  TOTALDUE: number;
  TOTALPAID?: number;
  WHENDUE?: string;
  WHENCREATED?: string;
  STATE: string;
  DESCRIPTION?: string;
  RECORDID?: string;
}

export class SageIntacctConnector extends BaseConnector {
  private apiUrl: string;
  private companyId: string;
  private userId: string;
  private userPassword: string;
  private senderId: string;
  private senderPassword: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.apiUrl = INTACCT_API_URL;
    this.companyId = this.getCredential('companyId');
    this.userId = this.getCredential('userId');
    this.userPassword = this.getCredential('userPassword');
    this.senderId = this.getSetting('senderId', '');
    this.senderPassword = this.getSetting('senderPassword', '');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const xml = this.buildXmlRequest(`
        <function controlid="testConnection">
          <getAPISession />
        </function>
      `);

      const response = await this.sendXmlRequest(xml);
      const sessionId = this.extractXmlValue(response, 'sessionid');

      return {
        connected: true,
        message: `Connected to Sage Intacct (Company: ${this.companyId})`,
        details: {
          companyId: this.companyId,
          sessionId: sessionId ? 'active' : 'unknown',
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
        sourceEntity: 'gl_accounts',
        targetEntity: 'chartOfAccounts',
        targetModule: 'financials',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'gl_entries',
        targetEntity: 'gl',
        targetModule: 'financials',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'ap_bills',
        targetEntity: 'payables',
        targetModule: 'financials',
        syncDirection: 'read',
        batchSize: 100,
      },
      {
        sourceEntity: 'ar_invoices',
        targetEntity: 'receivables',
        targetModule: 'financials',
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
      case 'gl_accounts':
        return this.fetchGLAccounts(options);
      case 'gl_entries':
        return this.fetchGLEntries(options);
      case 'ap_bills':
        return this.fetchAPBills(options);
      case 'ar_invoices':
        return this.fetchARInvoices(options);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchGLAccounts(options?: { limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const xml = this.buildXmlRequest(`
      <function controlid="getGLAccounts">
        <readByQuery>
          <object>GLACCOUNT</object>
          <fields>RECORDNO,ACCOUNTNO,TITLE,ACCOUNTTYPE,NORMALBALANCE,STATUS,CATEGORY,DEPARTMENTID</fields>
          <query>STATUS = 'active'</query>
          <pagesize>${limit}</pagesize>
          <returnFormat>xml</returnFormat>
        </readByQuery>
      </function>
    `);

    const response = await this.sendXmlRequest(xml);
    const records = this.parseXmlRecords<IntacctGLAccount>(response, 'glaccount');
    const total = this.extractXmlNumericValue(response, 'totalcount') || records.length;

    const transformed = records.map(acc => ({
      externalId: acc.RECORDNO,
      accountNumber: acc.ACCOUNTNO,
      name: acc.TITLE,
      accountType: acc.ACCOUNTTYPE,
      normalBalance: acc.NORMALBALANCE,
      status: acc.STATUS,
      category: acc.CATEGORY,
      departmentId: acc.DEPARTMENTID,
      integrationSource: 'sage_intacct',
    }));

    return {
      data: transformed,
      hasMore: offset + records.length < total,
      total,
    };
  }

  private async fetchGLEntries(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = '';
    if (options?.since) {
      const sinceDate = options.since.toISOString().split('T')[0];
      query = `BATCH_DATE >= '${sinceDate}'`;
    }

    const xml = this.buildXmlRequest(`
      <function controlid="getGLEntries">
        <readByQuery>
          <object>GLENTRY</object>
          <fields>RECORDNO,BATCH_DATE,BATCH_TITLE,ACCOUNTNO,DEBIT,CREDIT,DESCRIPTION,DEPARTMENTID,LOCATIONID,WHENCREATED</fields>
          ${query ? `<query>${query}</query>` : '<query></query>'}
          <pagesize>${limit}</pagesize>
          <returnFormat>xml</returnFormat>
        </readByQuery>
      </function>
    `);

    const response = await this.sendXmlRequest(xml);
    const records = this.parseXmlRecords<IntacctGLEntry>(response, 'glentry');
    const total = this.extractXmlNumericValue(response, 'totalcount') || records.length;

    const transformed = records.map(entry => ({
      externalId: entry.RECORDNO,
      batchDate: entry.BATCH_DATE,
      batchTitle: entry.BATCH_TITLE,
      accountNumber: entry.ACCOUNTNO,
      debit: entry.DEBIT || 0,
      credit: entry.CREDIT || 0,
      description: entry.DESCRIPTION,
      departmentId: entry.DEPARTMENTID,
      locationId: entry.LOCATIONID,
      createdAt: entry.WHENCREATED,
      integrationSource: 'sage_intacct',
    }));

    return {
      data: transformed,
      hasMore: offset + records.length < total,
      total,
    };
  }

  private async fetchAPBills(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = '';
    if (options?.since) {
      const sinceDate = options.since.toISOString().split('T')[0];
      query = `WHENCREATED >= '${sinceDate}'`;
    }

    const xml = this.buildXmlRequest(`
      <function controlid="getAPBills">
        <readByQuery>
          <object>APBILL</object>
          <fields>RECORDNO,VENDORID,VENDORNAME,TOTALDUE,TOTALPAID,WHENDUE,WHENCREATED,STATE,DESCRIPTION,BILLNO</fields>
          ${query ? `<query>${query}</query>` : '<query></query>'}
          <pagesize>${limit}</pagesize>
          <returnFormat>xml</returnFormat>
        </readByQuery>
      </function>
    `);

    const response = await this.sendXmlRequest(xml);
    const records = this.parseXmlRecords<IntacctAPBill>(response, 'apbill');
    const total = this.extractXmlNumericValue(response, 'totalcount') || records.length;

    const transformed = records.map(bill => ({
      externalId: bill.RECORDNO,
      vendorId: bill.VENDORID,
      vendorName: bill.VENDORNAME,
      totalDue: bill.TOTALDUE,
      totalPaid: bill.TOTALPAID || 0,
      dueDate: bill.WHENDUE,
      createdAt: bill.WHENCREATED,
      status: bill.STATE,
      description: bill.DESCRIPTION,
      billNumber: bill.BILLNO,
      integrationSource: 'sage_intacct',
    }));

    return {
      data: transformed,
      hasMore: offset + records.length < total,
      total,
    };
  }

  private async fetchARInvoices(options?: { since?: Date; limit?: number; offset?: number }): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = '';
    if (options?.since) {
      const sinceDate = options.since.toISOString().split('T')[0];
      query = `WHENCREATED >= '${sinceDate}'`;
    }

    const xml = this.buildXmlRequest(`
      <function controlid="getARInvoices">
        <readByQuery>
          <object>ARINVOICE</object>
          <fields>RECORDNO,CUSTOMERID,CUSTOMERNAME,TOTALDUE,TOTALPAID,WHENDUE,WHENCREATED,STATE,DESCRIPTION,RECORDID</fields>
          ${query ? `<query>${query}</query>` : '<query></query>'}
          <pagesize>${limit}</pagesize>
          <returnFormat>xml</returnFormat>
        </readByQuery>
      </function>
    `);

    const response = await this.sendXmlRequest(xml);
    const records = this.parseXmlRecords<IntacctARInvoice>(response, 'arinvoice');
    const total = this.extractXmlNumericValue(response, 'totalcount') || records.length;

    const transformed = records.map(invoice => ({
      externalId: invoice.RECORDNO,
      customerId: invoice.CUSTOMERID,
      customerName: invoice.CUSTOMERNAME,
      totalDue: invoice.TOTALDUE,
      totalPaid: invoice.TOTALPAID || 0,
      dueDate: invoice.WHENDUE,
      createdAt: invoice.WHENCREATED,
      status: invoice.STATE,
      description: invoice.DESCRIPTION,
      invoiceNumber: invoice.RECORDID,
      integrationSource: 'sage_intacct',
    }));

    return {
      data: transformed,
      hasMore: offset + records.length < total,
      total,
    };
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    switch (entityType) {
      case 'chartOfAccounts':
        return { created: true, updated: false, id: `glaccount_${data.externalId}` };
      case 'gl':
        return { created: true, updated: false, id: `glentry_${data.externalId}` };
      case 'payables':
        return { created: true, updated: false, id: `apbill_${data.externalId}` };
      case 'receivables':
        return { created: true, updated: false, id: `arinvoice_${data.externalId}` };
      default:
        throw new Error(`Cannot save entity type: ${entityType}`);
    }
  }

  private buildXmlRequest(functionBody: string): string {
    const controlId = `req_${Date.now()}`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<request>
  <control>
    <senderid>${this.escapeXml(this.senderId)}</senderid>
    <password>${this.escapeXml(this.senderPassword)}</password>
    <controlid>${controlId}</controlid>
    <uniqueid>false</uniqueid>
    <dtdversion>3.0</dtdversion>
    <includewhitespace>false</includewhitespace>
  </control>
  <operation>
    <authentication>
      <login>
        <userid>${this.escapeXml(this.userId)}</userid>
        <companyid>${this.escapeXml(this.companyId)}</companyid>
        <password>${this.escapeXml(this.userPassword)}</password>
      </login>
    </authentication>
    <content>
      ${functionBody}
    </content>
  </operation>
</request>`;
  }

  private async sendXmlRequest(xml: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xml,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sage Intacct API error (${response.status}): ${errorText}`);
    }

    const responseText = await response.text();

    const errorMatch = responseText.match(/<errormessage>[\s\S]*?<description2>([\s\S]*?)<\/description2>/);
    if (errorMatch) {
      throw new Error(`Sage Intacct error: ${errorMatch[1].trim()}`);
    }

    return responseText;
  }

  private extractXmlValue(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private extractXmlNumericValue(xml: string, tag: string): number | null {
    const value = this.extractXmlValue(xml, tag);
    return value ? parseInt(value, 10) : null;
  }

  private parseXmlRecords<T>(xml: string, recordTag: string): T[] {
    const records: T[] = [];
    const recordRegex = new RegExp(`<${recordTag}>([\s\S]*?)</${recordTag}>`, 'gi');
    let match;

    while ((match = recordRegex.exec(xml)) !== null) {
      const recordXml = match[1];
      const record: any = {};

      const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(recordXml)) !== null) {
        record[fieldMatch[1]] = fieldMatch[2];
      }

      records.push(record as T);
    }

    return records;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
