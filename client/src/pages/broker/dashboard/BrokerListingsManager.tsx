import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import BrokerDashboardLayout from "./BrokerDashboardLayout";
import {
  useMyBrokerProfile,
  useMyClaims,
  useUnclaimedSuggestions,
  useClaimListing,
} from "@/hooks/use-broker-dashboard";

export default function BrokerListingsManager() {
  const { toast } = useToast();
  const { data: profileData } = useMyBrokerProfile();
  const profileId = profileData?.profile.id;

  const [tab, setTab] = useState<"claimed" | "suggested">("claimed");
  const { data: claims, isLoading: loadingClaims } = useMyClaims(profileId);
  const { data: suggested, isLoading: loadingSuggested } = useUnclaimedSuggestions(profileId);
  const claimMut = useClaimListing();

  const handleClaim = async (listingId: string) => {
    if (!profileId) return;
    try {
      await claimMut.mutateAsync({ listingId, brokerProfileId: profileId });
      toast({ title: "Claim submitted" });
    } catch (e: any) {
      toast({ title: "Claim failed", description: e?.message || "", variant: "destructive" });
    }
  };

  return (
    <BrokerDashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Listings</h1>

        <div className="flex gap-2">
          <Button
            variant={tab === "claimed" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("claimed")}
          >
            My Claimed Listings
          </Button>
          <Button
            variant={tab === "suggested" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("suggested")}
          >
            Suggested to Claim
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {tab === "claimed" ? "Claimed Listings" : "Suggested Listings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tab === "claimed" ? (
              loadingClaims ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !claims?.items?.length ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  You haven't claimed any listings yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listing</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(claims.items as any[]).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.listingId || c.listing?.title || c.id}</TableCell>
                        <TableCell>{c.claimMethod}</TableCell>
                        <TableCell>{c.verified ? "Verified" : "Pending"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : loadingSuggested ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !suggested?.items?.length ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No suggested listings match your contact info right now.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Broker Email</TableHead>
                    <TableHead>Broker Phone</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suggested.items.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.title || l.id}</TableCell>
                      <TableCell>{l.brokerEmail || "—"}</TableCell>
                      <TableCell>{l.brokerPhone || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => handleClaim(l.id)}>
                          Claim
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </BrokerDashboardLayout>
  );
}
