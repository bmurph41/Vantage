import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// ADP API (payroll & HR)
// Base: https://api.adp.com/hr/v2
// Auth: OAuth 2.0 client credentials with certificate
// Entities: /workers, /payroll/pay-data-input, /organization-departments, /pay-statements, /time-cards
// Rate limit: 200 requests/minute

interface AdpWorker {
  associateOID: string;
  workerID: { idValue: string };
  person: {
    legalName: { givenName: string; familyName1: string; formattedName: string };
    birthDate: string;
    communication: {
      emails: Array<{ emailUri: string; nameCode: string }>;
      landlines: Array<{ formattedNumber: string }>;
      mobiles: Array<{ formattedNumber: string }>;
    };
    legalAddress?: {
      lineOne: string;
      cityName: string;
      countrySubdivisionLevel1: string;
      postalCode: string;
    };
  };
  workerDates: { originalHireDate: string; terminationDate?: string; rehireDate?: string };
  workerStatus: { statusCode: 'Active' | 'Inactive' | 'Terminated' | 'Leave' };
  businessCommunication?: {
    emails: Array<{ emailUri: string }>;
  };
  workAssignment: {
    positionTitle: string;
    managementPositionIndicator: boolean;
    homeOrganizationalUnit: { nameCode: string; shortName: string };
    baseRemuneration: { payPeriodRateAmount: { amountValue: number }; annualRateAmount: { amountValue: number } };
    standardPayPeriodHours: { hoursQuantity: number };
    fullTimeEquivalenceRatio: number;
    workerTypeCode: 'Employee' | 'Contractor';
    jobCode: string;
    payrollGroupCode: string;
  };
}

interface AdpPayStatement {
  payStatementID: string;
  associateOID: string;
  payDate: string;
  payPeriod: { startDate: string; endDate: string };
  grossPayAmount: number;
  netPayAmount: number;
  totalDeductions: number;
  totalTaxes: number;
  regularHoursWorked: number;
  overtimeHoursWorked: number;
  earnings: Array<{
    earningCode: string;
    earningName: string;
    hours: number;
    rate: number;
    amount: number;
  }>;
  deductions: Array<{
    deductionCode: string;
    deductionName: string;
    employeeAmount: number;
    employerAmount: number;
  }>;
  taxes: Array<{
    taxCode: string;
    taxName: string;
    employeeAmount: number;
    employerAmount: number;
  }>;
}

interface AdpDepartment {
  organizationOID: string;
  departmentCode: string;
  shortName: string;
  longName: string;
  parentOID?: string;
  headCount: number;
  costCenterCode?: string;
  isActive: boolean;
}

interface AdpTimeCard {
  timeCardID: string;
  associateOID: string;
  payPeriod: { startDate: string; endDate: string };
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  ptoHours: number;
  sickHours: number;
  holidayHours: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'processed';
  approvedBy?: string;
  entries: Array<{
    date: string;
    hoursWorked: number;
    earningCode: string;
    costCenter?: string;
    projectCode?: string;
  }>;
}

interface AdpBenefitEnrollment {
  enrollmentID: string;
  associateOID: string;
  benefitPlanName: string;
  benefitType: 'medical' | 'dental' | 'vision' | 'life' | '401k' | 'hsa' | 'fsa' | 'disability';
  coverageLevel: 'employee' | 'employee_spouse' | 'employee_family' | 'waived';
  employeeContribution: number;
  employerContribution: number;
  effectiveDate: string;
  terminationDate?: string;
  status: 'active' | 'terminated' | 'pending';
}

export class AdpConnector extends BaseConnector {
  private baseUrl = 'https://api.adp.com/hr/v2';
  private orgId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.orgId = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ organizations: Array<{ organizationName: string }> }>(
        '/core/organization'
      );
      const orgName = response.organizations?.[0]?.organizationName;
      return {
        connected: true,
        message: `Connected to ADP - ${orgName || 'Unknown Organization'}`,
        details: { organizationName: orgName },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'workers', targetEntity: 'employees', targetModule: 'hr', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'payStatements', targetEntity: 'payrolls', targetModule: 'accounting', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'departments', targetEntity: 'departments', targetModule: 'hr', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'timeCards', targetEntity: 'timeCards', targetModule: 'hr', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'benefitEnrollments', targetEntity: 'benefits', targetModule: 'hr', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const endpointMap: Record<string, string> = {
      workers: '/workers',
      payStatements: '/payroll/v1/pay-statements',
      departments: '/core/organization-departments',
      timeCards: '/time/v2/time-cards',
      benefitEnrollments: '/benefits/v1/enrollments',
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    let queryParams = `?$top=${limit}&$skip=${offset}`;
    if (options?.since) queryParams += `&$filter=modifiedOn ge '${options.since.toISOString()}'`;

    const response = await this.makeAuthenticatedRequest<{ workers?: any[]; payStatements?: any[]; departments?: any[]; timeCards?: any[]; enrollments?: any[]; meta?: { totalCount: number } }>(
      `${endpoint}${queryParams}`
    );

    const dataKey = Object.keys(response).find(k => Array.isArray(response[k as keyof typeof response]));
    const records = dataKey ? (response as any)[dataKey] : [];
    const total = response.meta?.totalCount;
    const transformed = records.map((record: any) => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: records.length === limit, total };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'workers': {
        const w = record as AdpWorker;
        return {
          externalId: w.associateOID, workerId: w.workerID?.idValue,
          firstName: w.person?.legalName?.givenName,
          lastName: w.person?.legalName?.familyName1,
          email: w.person?.communication?.emails?.[0]?.emailUri,
          phone: w.person?.communication?.mobiles?.[0]?.formattedNumber ||
                 w.person?.communication?.landlines?.[0]?.formattedNumber,
          dateOfBirth: w.person?.birthDate, address: w.person?.legalAddress,
          hireDate: w.workerDates?.originalHireDate,
          terminationDate: w.workerDates?.terminationDate,
          status: w.workerStatus?.statusCode,
          positionTitle: w.workAssignment?.positionTitle,
          department: w.workAssignment?.homeOrganizationalUnit?.shortName,
          annualSalary: w.workAssignment?.baseRemuneration?.annualRateAmount?.amountValue,
          workerType: w.workAssignment?.workerTypeCode,
          fullTimeEquivalence: w.workAssignment?.fullTimeEquivalenceRatio,
          integrationSource: 'adp',
        };
      }
      case 'payStatements': {
        const p = record as AdpPayStatement;
        return {
          externalId: p.payStatementID, employeeExternalId: p.associateOID,
          payDate: p.payDate, payPeriodStart: p.payPeriod?.startDate,
          payPeriodEnd: p.payPeriod?.endDate, grossPay: p.grossPayAmount,
          netPay: p.netPayAmount, totalDeductions: p.totalDeductions,
          totalTaxes: p.totalTaxes, regularHours: p.regularHoursWorked,
          overtimeHours: p.overtimeHoursWorked, earnings: p.earnings,
          deductions: p.deductions, taxes: p.taxes, integrationSource: 'adp',
        };
      }
      case 'departments': {
        const d = record as AdpDepartment;
        return {
          externalId: d.organizationOID, departmentCode: d.departmentCode,
          shortName: d.shortName, longName: d.longName,
          parentExternalId: d.parentOID, headCount: d.headCount,
          costCenterCode: d.costCenterCode, isActive: d.isActive,
          integrationSource: 'adp',
        };
      }
      case 'timeCards': {
        const t = record as AdpTimeCard;
        return {
          externalId: t.timeCardID, employeeExternalId: t.associateOID,
          payPeriodStart: t.payPeriod?.startDate, payPeriodEnd: t.payPeriod?.endDate,
          totalHours: t.totalHours, regularHours: t.regularHours,
          overtimeHours: t.overtimeHours, ptoHours: t.ptoHours,
          sickHours: t.sickHours, holidayHours: t.holidayHours,
          status: t.status, approvedBy: t.approvedBy,
          entries: t.entries, integrationSource: 'adp',
        };
      }
      case 'benefitEnrollments': {
        const b = record as AdpBenefitEnrollment;
        return {
          externalId: b.enrollmentID, employeeExternalId: b.associateOID,
          benefitPlanName: b.benefitPlanName, benefitType: b.benefitType,
          coverageLevel: b.coverageLevel, employeeContribution: b.employeeContribution,
          employerContribution: b.employerContribution, effectiveDate: b.effectiveDate,
          terminationDate: b.terminationDate, status: b.status,
          integrationSource: 'adp',
        };
      }
      default:
        return record;
    }
  }

  protected async saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }> {
    // ADP is primarily read-only via API; modifications require specific event-driven workflows
    return { created: false, updated: false };
  }

  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options?: { method?: string; body?: any }
  ): Promise<T> {
    const accessToken = this.getCredential('accessToken');
    return this.makeRequest<T>(`${this.baseUrl}${endpoint}`, {
      method: options?.method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'ADP-UserID': this.orgId,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
