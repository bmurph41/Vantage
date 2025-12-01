import { db } from "./db";
import { 
  customers, boats, slips, leases, launches, payments, integrations, communications 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create sample customers
  const sampleCustomers = await db.insert(customers).values([
    {
      firstName: "John",
      lastName: "Smith",
      email: "john.smith@email.com",
      phone: "+1-555-0101",
      address: "123 Harbor Drive, Miami, FL 33101",
      emergencyContact: {
        name: "Jane Smith",
        phone: "+1-555-0102",
        relationship: "spouse"
      },
    },
    {
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.johnson@email.com", 
      phone: "+1-555-0201",
      address: "456 Marina Blvd, Fort Lauderdale, FL 33301",
      emergencyContact: {
        name: "Mike Johnson",
        phone: "+1-555-0202", 
        relationship: "spouse"
      },
    },
    {
      firstName: "Robert",
      lastName: "Wilson", 
      email: "robert.wilson@email.com",
      phone: "+1-555-0301", 
      address: "789 Yacht Club Way, Key West, FL 33040",
      emergencyContact: {
        name: "Lisa Wilson",
        phone: "+1-555-0302",
        relationship: "spouse"
      },
    },
    {
      firstName: "Emily",
      lastName: "Davis",
      email: "emily.davis@email.com",
      phone: "+1-555-0401",
      address: "321 Dock Street, Naples, FL 34102",
      emergencyContact: {
        name: "Tom Davis", 
        phone: "+1-555-0402",
        relationship: "spouse"
      },
    },
  ]).returning();

  // Create sample slips
  const sampleSlips = await db.insert(slips).values([
    {
      number: "A-01",
      type: "wet",
      section: "A",
      maxLength: "30.00",
      maxBeam: "12.00",
      maxDraft: "4.00",
      utilities: ["water", "electric", "wifi"],
      monthlyRate: "450.00",
      isOccupied: false,
      currentBoatId: null,
    },
    {
      number: "A-02",
      type: "wet", 
      section: "A",
      maxLength: "35.00",
      maxBeam: "14.00",
      maxDraft: "5.00",
      utilities: ["water", "electric", "wifi"],
      monthlyRate: "520.00",
      isOccupied: false,
      currentBoatId: null,
    },
    {
      number: "B-01", 
      type: "wet",
      section: "B",
      maxLength: "40.00",
      maxBeam: "16.00",
      maxDraft: "6.00",
      utilities: ["water", "electric", "wifi", "cable"],
      monthlyRate: "650.00",
      isOccupied: false,
      currentBoatId: null,
    },
    {
      number: "B-02",
      type: "wet",
      section: "B",
      maxLength: "45.00",
      maxBeam: "18.00",
      maxDraft: "7.00", 
      utilities: ["water", "electric", "wifi", "cable"],
      monthlyRate: "780.00",
      isOccupied: false,
      currentBoatId: null,
    },
    {
      number: "C-01",
      type: "wet",
      section: "C",
      maxLength: "50.00",
      maxBeam: "20.00",
      maxDraft: "8.00",
      utilities: ["water", "electric", "wifi", "cable", "pump-out"],
      monthlyRate: "950.00",
      isOccupied: false,
      currentBoatId: null,
    },
  ]).returning();

  // Create sample boats
  const sampleBoats = await db.insert(boats).values([
    {
      customerId: sampleCustomers[0].id,
      name: "Sea Breeze",
      make: "Catalina",
      model: "320",
      year: 2018,
      length: "32.00",
      beam: "11.00",
      draft: "5.00",
      hullId: "CTL32001A818",
      registrationNumber: "FL1234AB",
      insuranceInfo: {
        provider: "BoatUS",
        policyNumber: "BUS-789456123",
        expirationDate: "2025-12-31"
      },
    },
    {
      customerId: sampleCustomers[1].id,
      name: "Wave Runner",
      make: "Sea Ray", 
      model: "280 Sundancer",
      year: 2020,
      length: "28.00",
      beam: "9.00",
      draft: "3.00",
      hullId: "SRY28002B020",
      registrationNumber: "FL5678CD",
      insuranceInfo: {
        provider: "Progressive",
        policyNumber: "PRG-456789012",
        expirationDate: "2025-06-30"
      },
    },
    {
      customerId: sampleCustomers[2].id,
      name: "Ocean Explorer", 
      make: "Azimut",
      model: "Flybridge 43",
      year: 2019,
      length: "45.00",
      beam: "15.00",
      draft: "6.00",
      hullId: "AZT43003C019",
      registrationNumber: "FL9012EF",
      insuranceInfo: {
        provider: "Chubb",
        policyNumber: "CHB-123456789",
        expirationDate: "2025-03-15"
      },
    },
    {
      customerId: sampleCustomers[3].id,
      name: "Sunset Dream",
      make: "Jeanneau",
      model: "Sun Odyssey 380",
      year: 2021,
      length: "38.00",
      beam: "12.00",
      draft: "6.00",
      hullId: "JEA38004D021", 
      registrationNumber: "FL3456GH",
      insuranceInfo: {
        provider: "BoatUS",
        policyNumber: "BUS-987654321",
        expirationDate: "2025-08-20"
      },
    },
  ]).returning();

  // Create sample leases (occupy some slips)
  const sampleLeases = await db.insert(leases).values([
    {
      customerId: sampleCustomers[0].id,
      boatId: sampleBoats[0].id,
      slipId: sampleSlips[0].id,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-12-31"),
      monthlyRate: "450.00", 
      depositAmount: "900.00",
      status: "active",
      autoRenew: true,
    },
    {
      customerId: sampleCustomers[2].id,
      boatId: sampleBoats[2].id,
      slipId: sampleSlips[2].id,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-05-31"),
      monthlyRate: "650.00",
      depositAmount: "1300.00",
      status: "active",
      autoRenew: false,
    },
  ]).returning();

  // Update slip occupancy for leased slips
  await db.update(slips).set({
    isOccupied: true,
    currentBoatId: sampleBoats[0].id,
  }).where(eq(slips.id, sampleSlips[0].id));

  await db.update(slips).set({
    isOccupied: true,
    currentBoatId: sampleBoats[2].id, 
  }).where(eq(slips.id, sampleSlips[2].id));

  // Create sample payments
  await db.insert(payments).values([
    {
      customerId: sampleCustomers[0].id,
      leaseId: sampleLeases[0].id,
      amount: "450.00",
      dueDate: new Date("2024-09-01"),
      status: "paid",
      paidDate: new Date("2024-08-28"),
      paymentMethod: "card",
      transactionId: "tx_sep2024_450",
    },
    {
      customerId: sampleCustomers[0].id,
      leaseId: sampleLeases[0].id, 
      amount: "450.00",
      dueDate: new Date("2024-10-01"),
      status: "pending",
      paidDate: null,
      paymentMethod: null,
      transactionId: null,
    },
    {
      customerId: sampleCustomers[2].id,
      leaseId: sampleLeases[1].id,
      amount: "650.00", 
      dueDate: new Date("2024-09-01"),
      status: "paid",
      paidDate: new Date("2024-08-30"),
      paymentMethod: "ach",
      transactionId: "tx_sep2024_650",
    },
    {
      customerId: sampleCustomers[1].id,
      leaseId: null,
      amount: "85.00",
      dueDate: new Date("2024-09-15"),
      status: "overdue",
      paidDate: null,
      paymentMethod: null,
      transactionId: null,
    },
  ]);

  // Create sample launches
  await db.insert(launches).values([
    {
      customerId: sampleCustomers[1].id,
      boatId: sampleBoats[1].id,
      scheduledTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      status: "scheduled",
      notes: "Handle with care - new gel coat",
      staffAssigned: "Mike",
    },
    {
      customerId: sampleCustomers[3].id,
      boatId: sampleBoats[3].id,
      scheduledTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      status: "scheduled",
      notes: "Check rigging before launch",
      staffAssigned: "Sarah",
    },
    {
      customerId: sampleCustomers[0].id,
      boatId: sampleBoats[0].id,
      scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      status: "scheduled", 
      notes: null,
      staffAssigned: "Mike",
    },
  ]);

  // Create sample integrations
  await db.insert(integrations).values([
    {
      platform: "speedydock",
      isEnabled: true,
      credentials: { apiKey: "sd_test_key_12345", apiSecret: "sd_secret_12345" },
      syncStatus: "connected",
      lastSync: new Date(),
      config: { autoSync: true, syncInterval: 15 },
    },
    {
      platform: "dockwa",
      isEnabled: false,
      credentials: { apiKey: "dw_test_key_67890", apiSecret: "dw_secret_67890" }, 
      syncStatus: "disconnected",
      lastSync: null,
      config: { autoSync: false, syncInterval: 30 },
    },
    {
      platform: "snag_a_slip",
      isEnabled: true,
      credentials: { apiKey: "sas_test_key_54321", apiSecret: "sas_secret_54321" },
      syncStatus: "error",
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      config: { autoSync: true, syncInterval: 60 },
    },
  ]);

  // Create sample communications
  await db.insert(communications).values([
    {
      customerId: sampleCustomers[0].id,
      type: "email",
      subject: "Welcome to Marina Management System",
      message: "Thank you for choosing our marina. Your slip A-01 is ready!",
      status: "sent",
      sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      scheduledFor: null,
    },
    {
      customerId: sampleCustomers[1].id,
      type: "sms", 
      subject: "Boat Launch Reminder",
      message: "Your boat launch is scheduled for today at 2:00 PM. Please arrive 15 minutes early.",
      status: "pending",
      sentAt: null,
      scheduledFor: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    },
  ]);

  console.log("✅ Database seeded successfully!");
  console.log(`Created ${sampleCustomers.length} customers`);
  console.log(`Created ${sampleBoats.length} boats`);
  console.log(`Created ${sampleSlips.length} slips`);
  console.log(`Created ${sampleLeases.length} leases`);
  console.log("Created sample payments, launches, integrations, and communications");

  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});