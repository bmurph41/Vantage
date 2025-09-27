import MilestoneProgressBar from "../components/MilestoneProgressBar";
import type { Milestone } from "../types/dd";

const milestones: Milestone[] = [
  { id: "ioi",  title: "IOI Sent",              due: "2025-10-01", positionPct: 5,  color: "bg-green-500" },
  { id: "ddi",  title: "DD Kickoff",            due: "2025-10-08", positionPct: 48 },
  { id: "lender", title: "Lender Term Sheet",   due: "2025-10-18", positionPct: 60 },
  { id: "ics",  title: "IC Signoff",            due: "2025-11-20", positionPct: 88 },
];

export default function MilestoneDemo() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Milestone Progress Bar Demo</h1>
          <p className="text-gray-600 mb-6">
            Hover over or tab to the milestone dots to see tooltips with title, due date, and position percentage.
          </p>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Marina Acquisition Project</h2>
              <MilestoneProgressBar 
                progressPct={39} 
                elapsedLabel="39% elapsed" 
                milestones={milestones} 
              />
            </div>
            
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Different Progress Levels</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">25% Progress</h3>
                  <MilestoneProgressBar 
                    progressPct={25} 
                    elapsedLabel="25% elapsed" 
                    milestones={milestones} 
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">75% Progress</h3>
                  <MilestoneProgressBar 
                    progressPct={75} 
                    elapsedLabel="75% elapsed" 
                    milestones={milestones} 
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">100% Complete</h3>
                  <MilestoneProgressBar 
                    progressPct={100} 
                    elapsedLabel="100% complete" 
                    milestones={milestones} 
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Acceptance Criteria:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Hovering or tabbing to a dot shows a tooltip with milestone title and due date</li>
                <li>✓ Tooltips don't overflow the bar on far-left/right dots (nudge logic works)</li>
                <li>✓ Keyboard accessible (Tab, Shift+Tab, Esc)</li>
                <li>✓ Mobile tap toggles the tooltip; tapping outside closes it</li>
                <li>✓ No new dependencies added</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}