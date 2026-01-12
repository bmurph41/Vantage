import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "../../lib/rentRollApi";
import { format } from "date-fns";
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertCircle 
} from "lucide-react";
import { 
  RentRollCountModal, 
  MonthlyRevenueModal, 
  NetMovesModal, 
  DiscrepancyModal 
} from "./SummaryCardModals";

type ModalType = "rentRollCount" | "monthlyRevenue" | "netMoves" | "discrepancy" | null;

export default function RentRollSummaryCards() {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  
  const currentMonth = format(new Date(), "yyyy-MM");
  const { data: summaryData, isLoading } = useQuery({
    queryKey: ["/api/rent-roll/monthly-summary", currentMonth],
    queryFn: () => getMonthlySummary({ from: currentMonth, to: currentMonth }),
  });

  const currentData = summaryData?.[0];
  
  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0";
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };
  
  const cards: Array<{
    title: string;
    value: string;
    subtitle: string;
    icon: typeof Users;
    testId: string;
    modalType: ModalType;
  }> = [
    {
      title: "Rent Roll Count",
      value: currentData?.rentRollCount?.toString() || "0",
      subtitle: "Active leases",
      icon: Users,
      testId: "card-rent-roll-count",
      modalType: "rentRollCount",
    },
    {
      title: "Monthly Revenue",
      value: formatCurrency(currentData?.totalContractedRevenue),
      subtitle: "Contracted revenue",
      icon: DollarSign,
      testId: "card-monthly-revenue",
      modalType: "monthlyRevenue",
    },
    {
      title: "Net Moves (MTD)",
      value: currentData?.netMoves?.toString() || "0",
      subtitle: "Move-ins vs move-outs",
      icon: TrendingUp,
      testId: "card-net-moves",
      modalType: "netMoves",
    },
    {
      title: "Discrepancy",
      value: currentData?.discrepancy?.toString() || "0",
      subtitle: "Count variance",
      icon: AlertCircle,
      testId: "card-discrepancy",
      modalType: "discrepancy",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card 
              key={card.testId} 
              className="hover-elevate cursor-pointer transition-all" 
              data-testid={card.testId}
              onClick={() => setOpenModal(card.modalType)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tabular-nums" data-testid={`${card.testId}-value`}>
                  {card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.subtitle}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <RentRollCountModal
        open={openModal === "rentRollCount"}
        onClose={() => setOpenModal(null)}
        currentMonth={currentMonth}
        count={parseInt(currentData?.rentRollCount?.toString() || "0")}
      />
      
      <MonthlyRevenueModal
        open={openModal === "monthlyRevenue"}
        onClose={() => setOpenModal(null)}
        currentMonth={currentMonth}
        totalRevenue={currentData?.totalContractedRevenue || "0"}
      />
      
      <NetMovesModal
        open={openModal === "netMoves"}
        onClose={() => setOpenModal(null)}
        currentMonth={currentMonth}
        netMoves={parseInt(currentData?.netMoves?.toString() || "0")}
      />
      
      <DiscrepancyModal
        open={openModal === "discrepancy"}
        onClose={() => setOpenModal(null)}
        currentMonth={currentMonth}
        discrepancyCount={parseInt(currentData?.discrepancy?.toString() || "0")}
      />
    </>
  );
}
