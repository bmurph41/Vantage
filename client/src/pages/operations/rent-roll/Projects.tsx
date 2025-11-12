import { Card, CardContent } from "@/components/ui/card";
import { FolderKanban } from "lucide-react";

export default function RentRollProjects() {
  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-projects">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-projects">
          Rent Roll Projects
        </h1>
        <p className="text-muted-foreground" data-testid="description-rent-roll-projects">
          View and manage rent rolls organized by acquisition projects.
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <FolderKanban className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Project-Based Rent Rolls</h3>
          <p className="text-muted-foreground">
            Project view coming soon. This will show rent rolls grouped by due diligence projects for acquisition analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
