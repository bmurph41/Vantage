import { db } from "../server/db.js";
import { organizations, users, projects, projectSettings, tasks } from "../shared/schema.js";

async function seed() {
  console.log("Seeding database...");

  // Create organization
  const [org] = await db.insert(organizations).values({
    name: "MarinaMatch Demo",
  }).returning();

  // Create user
  const [user] = await db.insert(users).values({
    orgId: org.id,
    email: "demo@marinamatch.com",
    name: "Demo User",
    role: "owner",
  }).returning();

  // Create sample project
  const [project] = await db.insert(projects).values({
    orgId: org.id,
    name: "Marina Bay Acquisition",
    description: "Due diligence for marina acquisition in Marina Bay",
    anchorType: "psa",
    psaSignedDate: "2025-08-29",
    ddExpirationDate: "2025-10-28",
    closingDate: "2025-11-12",
    createdBy: user.id,
  }).returning();

  // Create project settings
  await db.insert(projectSettings).values({
    projectId: project.id,
    useBusinessDays: false,
    holidayCalendar: "us_federal",
    notificationsJson: {
      emailReminders: true,
      slackNotifications: false,
    },
    ndaRequired: false,
  });

  // Create sample tasks
  const sampleTasks = [
    {
      projectId: project.id,
      title: "Title Report",
      description: "Phase I property title research",
      startStrategy: "offset" as const,
      startOffsetDays: 0,
      durationDays: 7,
      assignee: "Jessica",
      status: "in_progress" as const,
      priority: "med" as const,
    },
    {
      projectId: project.id,
      title: "Survey",
      description: "Property boundary survey",
      startStrategy: "offset" as const,
      startOffsetDays: 1,
      durationDays: 14,
      assignee: "Jessica",
      status: "not_started" as const,
      priority: "med" as const,
    },
    {
      projectId: project.id,
      title: "Environmental",
      description: "Phase I Environmental Site Assessment",
      startStrategy: "offset" as const,
      startOffsetDays: 3,
      durationDays: 10,
      assignee: "Brett",
      companyHired: "UES",
      status: "not_started" as const,
      priority: "high" as const,
    },
    {
      projectId: project.id,
      title: "Insurance",
      description: "Property insurance quotes",
      startStrategy: "offset" as const,
      startOffsetDays: 5,
      durationDays: 7,
      assignee: "Luke",
      companyHired: "Brown & Brown",
      status: "completed" as const,
      priority: "med" as const,
      completedAt: new Date("2025-09-10"),
    },
    {
      projectId: project.id,
      title: "Debt",
      description: "Financing documentation",
      startStrategy: "offset" as const,
      startOffsetDays: 7,
      durationDays: 14,
      assignee: "Luke",
      companyHired: "Synovus/Citizens",
      status: "in_progress" as const,
      priority: "high" as const,
    },
    {
      projectId: project.id,
      title: "Property Inspection",
      description: "Structural inspection report",
      startStrategy: "offset" as const,
      startOffsetDays: 10,
      durationDays: 5,
      assignee: "Brett",
      companyHired: "Edgewater/Vertex",
      status: "not_started" as const,
      priority: "med" as const,
    },
    {
      projectId: project.id,
      title: "Crane Company",
      description: "Marine equipment assessment",
      startStrategy: "offset" as const,
      startOffsetDays: 12,
      durationDays: 7,
      assignee: "Brett",
      status: "not_started" as const,
      priority: "low" as const,
    },
  ];

  await db.insert(tasks).values(sampleTasks);

  console.log("Database seeded successfully!");
  console.log(`Organization: ${org.name} (${org.id})`);
  console.log(`User: ${user.name} (${user.email})`);
  console.log(`Project: ${project.name} (${project.id})`);
  console.log(`Tasks created: ${sampleTasks.length}`);
}

// Run seed function
seed().catch(console.error);
