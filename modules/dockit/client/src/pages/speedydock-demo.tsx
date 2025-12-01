import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import CustomerCheckIn from "@/components/launch/customer-checkin";
import LaunchQueueMonitor from "@/components/launch/launch-queue-monitor";
import StaffLaunchManager from "@/components/launch/staff-launch-manager";

export default function SpeedyDockDemo() {
  // Simulate a customer ID for demo purposes
  const demoCustomerId = "ea20a930-6508-4ecb-b241-4d5b56898c50"; // First customer from sample data

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        <TopBar />
        
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">SpeedyDock Launch System</h1>
            <p className="text-muted-foreground">
              Experience SpeedyDock-style boat launch management with GPS check-in, 
              live queue tracking, and staff workflow automation
            </p>
          </div>

          {/* Customer Experience Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <span className="w-8 h-8 bg-chart-1 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <span>Customer Experience</span>
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CustomerCheckIn 
                customerId={demoCustomerId}
                className="h-fit"
              />
              <LaunchQueueMonitor 
                className="h-fit"
                maxDisplay={4}
              />
            </div>
          </div>

          {/* Staff Management Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <span className="w-8 h-8 bg-chart-2 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <span>Staff Management</span>
            </h2>
            <StaffLaunchManager />
          </div>

          {/* Features Overview */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">SpeedyDock Features Implemented</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">✅ Customer Check-In</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• GPS-based location detection</li>
                  <li>• Real-time queue entry</li>
                  <li>• Mobile-optimized interface</li>
                  <li>• Automatic position tracking</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">✅ Live Queue Management</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Real-time queue positions</li>
                  <li>• Estimated wait times</li>
                  <li>• Visual progress tracking</li>
                  <li>• Auto-refresh updates</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">✅ Staff Workflow</h3>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Task-based organization</li>
                  <li>• Staff assignment system</li>
                  <li>• Priority management</li>
                  <li>• One-click status updates</li>
                </ul>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h3 className="font-semibold text-yellow-800 mb-2">✅ Security & Authentication</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Customer ownership validation</li>
                  <li>• Staff role verification</li>
                  <li>• API endpoint protection</li>
                  <li>• Session-based security</li>
                </ul>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <h3 className="font-semibold text-indigo-800 mb-2">✅ Queue Integrity</h3>
                <ul className="text-sm text-indigo-700 space-y-1">
                  <li>• Atomic queue operations</li>
                  <li>• Race condition prevention</li>
                  <li>• Transactional updates</li>
                  <li>• Consistent positioning</li>
                </ul>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-orange-800 mb-2">🚧 Future Enhancements</h3>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Fuel/supplies ordering</li>
                  <li>• Push notifications</li>
                  <li>• WebSocket real-time updates</li>
                  <li>• Digital signage display</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="font-semibold mb-3">🧪 Testing Instructions</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Customer Check-In:</strong> Click "Enable Location" to simulate GPS check-in, then "Check In" to join the queue.</p>
              <p><strong>Staff Management:</strong> Use the tabs to see check-ins, queue, and in-progress launches. Click action buttons to advance boats through the workflow.</p>
              <p><strong>Real-time Updates:</strong> The queue monitor and staff manager auto-refresh to show live changes.</p>
              <p><strong>Priority Management:</strong> Staff can assign different priority levels and specific team members to launches.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}