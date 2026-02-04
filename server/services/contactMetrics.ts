export type MetricsTimeframe = "all" | "ytd" | "last_12" | "last_24";
export type LeaderboardSortField = "score" | "volume" | "deals" | "name";
export async function getContactMetrics(orgId: string, contactId: string, timeframe: MetricsTimeframe) { return { deals: 0, volume: 0, feesWaived: 0, score: 0 }; }
export async function getLeaderboard(orgId: string, filters: any, sort: LeaderboardSortField, sortDirection: "asc" | "desc", page: number, pageSize: number) { return { items: [], total: 0, page, pageSize }; }
export async function updateContactRelationship(orgId: string, contactId: string, data: any) { return { id: contactId, ...data }; }
export async function linkContactToDeal(orgId: string, data: any) { return data; }
export async function getContactsForDeal(orgId: string, dealId: string) { return []; }
export async function removeContactFromDeal(orgId: string, dealId: string, contactId: string) { return true; }
export async function createFinancialEvent(orgId: string, data: any) { return data; }
export async function getFinancialEventsForDeal(orgId: string, dealId: string) { return []; }
export async function getFinancialEventsForContact(orgId: string, contactId: string) { return []; }
