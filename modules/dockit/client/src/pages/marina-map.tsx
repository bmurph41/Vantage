import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import MarinaMap from "@/components/marina/marina-map";
import SlipDetailPanel from "@/components/marina/slip-detail-panel";
import PhysicalMapEditor from "@/components/marina/physical-map-editor";
import type { Customer, Boat, Lease } from "@shared/schema";

interface EnrichedSlip {
  id: string;
  number: string;
  type: string;
  section: string;
  maxLength: string;
  maxBeam: string;
  maxDraft: string | null;
  utilities: string[] | null;
  monthlyRate: string;
  isOccupied: boolean;
  currentBoatId: string | null;
  customer: Customer | null;
  boat: Boat | null;
  lease: Lease | null;
  paymentStatus: string | null;
  lastPaymentDate: Date | null;
  launchCount: number;
}

export default function MarinaMapPage() {
  const [selectedSlip, setSelectedSlip] = useState<EnrichedSlip | null>(null);

  const handleSlipSelect = (slip: EnrichedSlip | null) => {
    setSelectedSlip(slip);
  };

  const handleCloseDetailPanel = () => {
    setSelectedSlip(null);
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-marina-map">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight" data-testid="title-marina-map">Marina Map</h1>
              <p className="text-muted-foreground mt-2">
                Interactive visual overview of all marina storage areas with real-time occupancy status
              </p>
            </div>

            <Tabs defaultValue="view" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="view" data-testid="tab-view-map">View Marina Map</TabsTrigger>
                <TabsTrigger value="design" data-testid="tab-design-map">Design Physical Layout</TabsTrigger>
              </TabsList>

              <TabsContent value="view" className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Marina Map - Takes 2/3 width on large screens */}
                  <div className="xl:col-span-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <span>Marina Layout</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MarinaMap 
                          onSlipSelect={handleSlipSelect}
                          selectedSlip={selectedSlip}
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Detail Panel - Takes 1/3 width on large screens */}
                  <div className="xl:col-span-1">
                    {selectedSlip ? (
                      <SlipDetailPanel 
                        slip={selectedSlip}
                        onClose={handleCloseDetailPanel}
                      />
                    ) : (
                      <Card data-testid="card-no-selection">
                        <CardHeader>
                          <CardTitle>Slip Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-center py-12 text-muted-foreground">
                            <div className="mb-4">
                              <svg 
                                className="mx-auto h-16 w-16 text-muted-foreground/50" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={1.5} 
                                  d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" 
                                />
                              </svg>
                            </div>
                            <p className="text-lg font-medium">No Slip Selected</p>
                            <p className="text-sm mt-1">
                              Click on any slip in the marina map to view detailed information
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="design" className="space-y-0">
                <PhysicalMapEditor />
              </TabsContent>
            </Tabs>

            {/* Quick Actions Row */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card data-testid="card-quick-actions">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Quick Actions</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Use the interactive map above to:
                    </p>
                    <ul className="text-sm text-left space-y-1">
                      <li>• Click any slip to view details</li>
                      <li>• Switch between storage types</li>
                      <li>• Search by slip or customer name</li>
                      <li>• Filter by occupancy status</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-map-legend">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Status Legend</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-green-500 rounded"></div>
                          <span>Available</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-blue-500 rounded"></div>
                          <span>Occupied</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                          <span>Payment Due</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-red-600 rounded"></div>
                          <span>Overdue</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-help-tips">
                <CardContent className="p-4">
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">Tips</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>• Selected slips show with a ring highlight</p>
                      <p>• Use search to quickly find specific slips</p>
                      <p>• Filter by status to focus on vacant or occupied slips</p>
                      <p>• Switch tabs to view different storage types</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}