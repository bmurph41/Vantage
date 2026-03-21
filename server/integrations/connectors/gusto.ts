import { BaseConnector, ConnectorConfig, EntitySyncConfig } from './base';

// Gusto API (payroll & HR)
// Base: https://api.gusto.com/v1
// Auth: OAuth 2.0 Bearer token
// Entities: /companies/{id}/employees, /payrolls, /departments, /benefits, /tax_forms
// Rate limit: 100 requests/minute

interface GustoEmployee {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  ssn_last_four?: string;
  department?: string;
  job_title?: string;
  hire_date: string;
  termination_date?: string;
  status: 'active' | 'terminated' | 'onboarding' | 'leave';
  pay_schedule: string;
  compensation: {
    rate: number;
    payment_unit: 'Hour' | 'Year';
    flsa_status: 'Exempt' | 'Nonexempt';
  };
  home_address?: {
    street_1: string;
    city: string;
    state: string;
    zip: string;
  };
  benefits: Array<{ benefit_type: string; employee_deduction: number; company_contribution: number }>;
}

interface GustoPayroll {
  id: number;
  pay_period_start: string;
  pay_period_end: string;
  check_date: string;
  payroll_deadline: string;
  processed: boolean;
  status: 'unprocessed' | 'processed' | 'calculated' | 'submitted';
  totals: {
    gross_pay: number;
    net_pay: number;
    employer_taxes: number;
    employee_taxes: number;
    employer_benefits: number;
    employee_deductions: number;
    reimbursements: number;
    total_debit: number;
  };
  employee_compensations: Array<{
    employee_id: number;
    gross_pay: number;
    net_pay: number;
    hours_worked: number;
    regular_hours: number;
    overtime_hours: number;
    pto_hours: number;
    sick_hours: number;
    taxes: number;
    deductions: number;
  }>;
}

interface GustoDepartment {
  id: number;
  uuid: string;
  title: string;
  parent_uuid?: string;
  employee_count: number;
  total_payroll_cost: number;
  is_active: boolean;
}

interface GustoBenefit {
  id: number;
  benefit_type: string;
  description: string;
  active: boolean;
  responsible_for_employee_w2: boolean;
  responsible_for_employer_taxes: boolean;
  company_contribution_type: 'fixed' | 'percent';
  company_contribution_amount: number;
  employee_deduction_type: 'fixed' | 'percent';
  employee_deduction_amount: number;
  enrolled_employees: number;
}

interface GustoTaxForm {
  id: number;
  employee_id: number;
  form_type: 'W2' | 'W4' | '1099' | 'I9' | 'W9';
  tax_year: number;
  filed_at?: string;
  status: 'draft' | 'filed' | 'corrected';
  federal_wages?: number;
  federal_tax_withheld?: number;
  state_wages?: number;
  state_tax_withheld?: number;
}

export class GustoConnector extends BaseConnector {
  private baseUrl = 'https://api.gusto.com/v1';
  private companyId: string;

  constructor(config: ConnectorConfig) {
    super(config);
    this.companyId = this.getCredential('companyId');
  }

  async testConnection(): Promise<{ connected: boolean; message: string; details?: any }> {
    try {
      const response = await this.makeAuthenticatedRequest<{ name: string; id: number; ein: string }>(
        `/companies/${this.companyId}`
      );
      return {
        connected: true,
        message: `Connected to Gusto - ${response.name || 'Unknown Company'}`,
        details: { companyName: response.name, companyId: response.id },
      };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : 'Connection failed' };
    }
  }

  getSupportedEntities(): EntitySyncConfig[] {
    return [
      { sourceEntity: 'employees', targetEntity: 'employees', targetModule: 'hr', syncDirection: 'read', batchSize: 100 },
      { sourceEntity: 'payrolls', targetEntity: 'payrolls', targetModule: 'accounting', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'departments', targetEntity: 'departments', targetModule: 'hr', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'benefits', targetEntity: 'benefits', targetModule: 'hr', syncDirection: 'read', batchSize: 50 },
      { sourceEntity: 'taxForms', targetEntity: 'taxForms', targetModule: 'accounting', syncDirection: 'read', batchSize: 100 },
    ];
  }

  async fetchEntities(
    entityType: string,
    options?: { since?: Date; limit?: number; offset?: number; filters?: Record<string, any> }
  ): Promise<{ data: any[]; hasMore: boolean; total?: number }> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const endpointMap: Record<string, string> = {
      employees: `/companies/${this.companyId}/employees`,
      payrolls: `/companies/${this.companyId}/payrolls`,
      departments: `/companies/${this.companyId}/departments`,
      benefits: `/companies/${this.companyId}/company_benefits`,
      taxForms: `/companies/${this.companyId}/tax_forms`,
    };

    const endpoint = endpointMap[entityType];
    if (!endpoint) throw new Error(`Unsupported entity type: ${entityType}`);

    let queryParams = `?page=${Math.floor(offset / limit) + 1}&per=${limit}`;
    if (options?.since && entityType === 'payrolls') {
      queryParams += `&start_date=${options.since.toISOString().split('T')[0]}`;
    }

    const response = await this.makeAuthenticatedRequest<any[]>(`${endpoint}${queryParams}`);
    const records = Array.isArray(response) ? response : [];
    const transformed = records.map(record => this.transformRecord(entityType, record));

    return { data: transformed, hasMore: records.length === limit };
  }

  private transformRecord(entityType: string, record: any): any {
    switch (entityType) {
      case 'employees': {
        const e = record as GustoEmployee;
        return {
          externalId: e.uuid || String(e.id), firstName: e.first_name,
          lastName: e.last_name, email: e.email, phone: e.phone,
          dateOfBirth: e.date_of_birth, department: e.department,
          jobTitle: e.job_title, hireDate: e.hire_date,
          terminationDate: e.termination_date, status: e.status,
          paySchedule: e.pay_schedule, compensationRate: e.compensation?.rate,
          paymentUnit: e.compensation?.payment_unit,
          flsaStatus: e.compensation?.flsa_status, address: e.home_address,
          benefits: e.benefits, integrationSource: 'gusto',
        };
      }
      case 'payrolls': {
        const p = record as GustoPayroll;
        return {
          externalId: String(p.id), payPeriodStart: p.pay_period_start,
          payPeriodEnd: p.pay_period_end, checkDate: p.check_date,
          processed: p.processed, status: p.status,
          grossPay: p.totals?.gross_pay, netPay: p.totals?.net_pay,
          employerTaxes: p.totals?.employer_taxes, employeeTaxes: p.totals?.employee_taxes,
          employerBenefits: p.totals?.employer_benefits,
          employeeDeductions: p.totals?.employee_deductions,
          totalDebit: p.totals?.total_debit,
          employeeCompensations: p.employee_compensations?.map(ec => ({
            employeeExternalId: String(ec.employee_id),
            grossPay: ec.gross_pay, netPay: ec.net_pay,
            hoursWorked: ec.hours_worked, regularHours: ec.regular_hours,
            overtimeHours: ec.overtime_hours, ptoHours: ec.pto_hours,
          })),
          integrationSource: 'gusto',
        };
      }
      case 'departments': {
        const d = record as GustoDepartment;
        return {
          externalId: d.uuid || String(d.id), title: d.title,
          parentExternalId: d.parent_uuid, employeeCount: d.employee_count,
          totalPayrollCost: d.total_payroll_cost, isActive: d.is_active,
          integrationSource: 'gusto',
        };
      }
      case 'benefits': {
        const b = record as GustoBenefit;
        return {
          externalId: String(b.id), benefitType: b.benefit_type,
          description: b.description, active: b.active,
          companyContributionType: b.company_contribution_type,
          companyContributionAmount: b.company_contribution_amount,
          employeeDeductionType: b.employee_deduction_type,
          employeeDeductionAmount: b.employee_deduction_amount,
          enrolledEmployees: b.enrolled_employees, integrationSource: 'gusto',
        };
      }
      case 'taxForms': {
        const tf = record as GustoTaxForm;
        return {
          externalId: String(tf.id), employeeExternalId: String(tf.employee_id),
          formType: tf.form_type, taxYear: tf.tax_year, filedAt: tf.filed_at,
          status: tf.status, federalWages: tf.federal_wages,
          federalTaxWithheld: tf.federal_tax_withheld,
          stateWages: tf.state_wages, stateTaxWithheld: tf.state_tax_withheld,
          integrationSource: 'gusto',
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
    // Gusto is primarily read-only; payroll operations require specific workflows
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
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
  }
}
