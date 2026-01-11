import { useQuery } from "@tanstack/react-query";
import RentRollDataQualityPanel from "../components/rent-roll/RentRollDataQualityPanel";

export default function PortfolioDataQualityPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/rent-roll/portfolio/data-quality"],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Portfolio Data Quality</h1>
        <p className="text-muted-foreground">
          Review data quality issues and validation warnings across your entire portfolio
        </p>
      </div>
      <RentRollDataQualityPanel 
        data={data} 
        isLoading={isLoading} 
        isError={isError} 
      />
    </div>
  );
}
