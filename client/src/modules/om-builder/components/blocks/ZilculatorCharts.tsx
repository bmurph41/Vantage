import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line, Area, PieChart, Pie, Cell, AreaChart } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";

const safeFormatCurrency = (value: number | undefined | null): string => {
  if (value === undefined || value === null || isNaN(value)) return '$0';
  return formatCurrency(value);
};

const COLORS = {
  goi: '#0d7377',
  noi: '#10b981',
  cfbt: '#3b82f6',
  cfat: '#22c55e',
  debt: '#ef4444',
  equity: '#10b981',
  appreciation: '#8b5cf6',
  cashOutlay: '#f59e0b',
};

const PIE_COLORS = ['#0d7377', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export interface GoiNoiCfChartProps {
  data?: Array<{
    year?: number | string;
    goi?: number;
    noi?: number;
    cfbt?: number;
    cfat?: number;
  }>;
  title?: string;
  showCfat?: boolean;
}

export function GoiNoiCfChart({ data = [], title = "GOI, NOI and CF Over Holding Period", showCfat = true }: GoiNoiCfChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
        <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border p-4">
      {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} tickFormatter={(val) => `Year ${val}`} />
          <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value: number, name: string) => [safeFormatCurrency(value), name.toUpperCase()]}
            contentStyle={{ fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar dataKey="goi" name="GOI" fill={COLORS.goi} radius={[4, 4, 0, 0]} />
          <Bar dataKey="noi" name="NOI" fill={COLORS.noi} radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="cfbt" name="CFBT" stroke={COLORS.cfbt} strokeWidth={2} dot={{ r: 4 }} />
          {showCfat && (
            <Line type="monotone" dataKey="cfat" name="CFAT" stroke={COLORS.cfat} strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface IncomeDistributionPieProps {
  data?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
  title?: string;
}

export function IncomeDistributionPie({ data = [], title = "Gross Operating Income Distribution" }: IncomeDistributionPieProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }
  
  const safeData = data.map(item => ({
    name: item.name || 'Unknown',
    value: item.value || 0,
    color: item.color,
  }));
  
  return (
    <div className="bg-white rounded-lg border p-4">
      {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={safeData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
            labelLine={{ strokeWidth: 1 }}
          >
            {safeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [safeFormatCurrency(value), 'Amount']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {safeData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1 text-xs">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: item.color || PIE_COLORS[index % PIE_COLORS.length] }} 
            />
            <span className="text-slate-600">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface EquityVsDebtChartProps {
  data?: Array<{
    year?: number | string;
    loanBalance?: number;
    principalPaid?: number;
    cashOutlay?: number;
    appreciation?: number;
  }>;
  title?: string;
}

export function EquityVsDebtChart({ data = [], title = "Cumulative Equity vs Debt" }: EquityVsDebtChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
        <div className="h-[250px] flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border p-4">
      {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} tickFormatter={(val) => `Year ${val}`} />
          <YAxis tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip 
            formatter={(value: number, name: string) => [safeFormatCurrency(value), name]}
            contentStyle={{ fontSize: '12px' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Area type="monotone" dataKey="loanBalance" name="Loan Balance" stackId="1" fill={COLORS.debt} stroke={COLORS.debt} fillOpacity={0.7} />
          <Area type="monotone" dataKey="principalPaid" name="Principal Paid" stackId="2" fill={COLORS.equity} stroke={COLORS.equity} fillOpacity={0.7} />
          <Area type="monotone" dataKey="cashOutlay" name="Cash Outlay" stackId="2" fill={COLORS.cashOutlay} stroke={COLORS.cashOutlay} fillOpacity={0.7} />
          <Area type="monotone" dataKey="appreciation" name="Appreciation" stackId="2" fill={COLORS.appreciation} stroke={COLORS.appreciation} fillOpacity={0.7} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="text-xs text-slate-500 mt-2 text-center">
        Green areas represent investor equity; red represents lender debt
      </div>
    </div>
  );
}

export interface ProjectCostsDistributionProps {
  data?: Array<{
    name?: string;
    value?: number;
    color?: string;
  }>;
  title?: string;
}

export function ProjectCostsDistributionPie({ data = [], title = "Project Costs Distribution" }: ProjectCostsDistributionProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
        <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }
  
  const safeData = data.map(item => ({
    name: item.name || 'Unknown',
    value: item.value || 0,
    color: item.color,
  }));
  
  return (
    <div className="bg-white rounded-lg border p-4">
      {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={safeData}
            cx="50%"
            cy="50%"
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
            label={({ percent }) => `${((percent || 0) * 100).toFixed(1)}%`}
          >
            {safeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [safeFormatCurrency(value), 'Amount']} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2 justify-center">
        {safeData.map((item, index) => (
          <div key={item.name} className="flex items-center gap-1 text-xs">
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: item.color || PIE_COLORS[index % PIE_COLORS.length] }} 
            />
            <span className="text-slate-600">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RevenueBreakdownChartProps {
  data?: Array<{
    category?: string;
    amount?: number;
    percentage?: number;
  }>;
  title?: string;
}

export function RevenueBreakdownChart({ data = [], title = "Revenue Breakdown" }: RevenueBreakdownChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-4">
        {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">
          No data available
        </div>
      </div>
    );
  }
  
  const safeData = data.map(item => ({
    category: item.category || 'Unknown',
    amount: item.amount || 0,
    percentage: item.percentage,
  }));
  
  return (
    <div className="bg-white rounded-lg border p-4">
      {title && <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={safeData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
          <XAxis type="number" tickFormatter={(val) => safeFormatCurrency(val)} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={75} />
          <Tooltip formatter={(value: number) => [safeFormatCurrency(value), 'Amount']} />
          <Bar dataKey="amount" fill={COLORS.goi} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
