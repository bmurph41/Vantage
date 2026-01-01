import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Building, Users, Trophy, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";

interface PerformerData {
  name: string;
  totalValue: number;
  dealCount: number;
  wonDeals: number;
}

interface TopPerformersData {
  topCompanies: PerformerData[];
  topContacts: PerformerData[];
}

interface PerformerListProps {
  title: string;
  data: PerformerData[];
  icon: React.ComponentType<{ className?: string }>;
}

function PerformerList({ title, data, icon: Icon }: PerformerListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((performer, index) => (
              <div key={performer.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-primary/10 rounded-full shrink-0">
                    {index === 0 && <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600" />}
                    {index === 1 && <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />}
                    {index === 2 && <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" />}
                    {index > 2 && <span className="text-xs sm:text-sm font-medium text-gray-600">{index + 1}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{performer.name}</p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      {performer.dealCount} deals • {performer.wonDeals} won
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">
                    ${performer.totalValue.toLocaleString()}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {performer.dealCount > 0 ? Math.round((performer.wonDeals / performer.dealCount) * 100) : 0}% win rate
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TopPerformersProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function TopPerformers({ dateRange }: TopPerformersProps) {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useQuery<TopPerformersData>({
    queryKey: ['/api/analytics/top-performers', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/top-performers?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch top performers data: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  // Handle errors with toast - must be in useEffect to avoid infinite re-renders
  useEffect(() => {
    if (error && !isLoading) {
      toast({
        title: "Failed to load top performers",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    }
  }, [error, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="animate-pulse">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                        <div>
                          <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                          <div className="h-3 bg-gray-200 rounded w-16"></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-12"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Failed to load top performers</p>
              <p className="text-gray-500 text-sm mb-4">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-900 font-medium mb-2">Failed to load top performers</p>
              <p className="text-gray-500 text-sm mb-4">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
      <PerformerList
        title="Top Companies"
        data={data?.topCompanies || []}
        icon={Building}
      />
      <PerformerList
        title="Top Contacts"
        data={data?.topContacts || []}
        icon={Users}
      />
    </div>
  );
}
