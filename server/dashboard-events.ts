import { dashboardWS } from './websocket';

export function notifyDashboardUpdate(orgId: string, module: 'crm' | 'dd' | 'sales-comps' | 'vdr' | 'docktalk' | 'fuel' | 'ship-store' | 'rent-roll' | 'modeling') {
  dashboardWS.notifyDashboardUpdate(orgId, module);
}

export const DashboardEvents = {
  crm: (orgId: string) => notifyDashboardUpdate(orgId, 'crm'),
  dd: (orgId: string) => notifyDashboardUpdate(orgId, 'dd'),
  salesComps: (orgId: string) => notifyDashboardUpdate(orgId, 'sales-comps'),
  vdr: (orgId: string) => notifyDashboardUpdate(orgId, 'vdr'),
  docktalk: (orgId: string) => notifyDashboardUpdate(orgId, 'docktalk'),
  fuel: (orgId: string) => notifyDashboardUpdate(orgId, 'fuel'),
  shipStore: (orgId: string) => notifyDashboardUpdate(orgId, 'ship-store'),
  rentRoll: (orgId: string) => notifyDashboardUpdate(orgId, 'rent-roll'),
  modeling: (orgId: string) => notifyDashboardUpdate(orgId, 'modeling'),
};
