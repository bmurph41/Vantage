import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import RentRollDataQualityPanel from "../components/rent-roll/RentRollDataQualityPanel";

export default function DataQualityPage() {
  const params = useParams();
  const projectId = params.id as string | undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/rent-roll/locations/${projectId}/data-quality`],
    enabled: !!projectId,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Data Quality</h1>
        <p className="text-muted-foreground">
          Review data quality issues and validation warnings for this project
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
