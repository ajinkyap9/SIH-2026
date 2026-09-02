// Mock Database for Government Interoperability Platform & Department APIs

export const db = {
  // Registered Citizens and Corporate Entities (Simulated DigiLocker / e-KYC Registry)
  users: [
    {
      id: "USR-001",
      name: "ABC Industries Pvt Ltd",
      type: "BUSINESS",
      pan: "ABCDE1234F",
      aadhaar: "998877665544",
      authorizedPerson: "Vikram Malhotra (Director)",
      phone: "+91 98765 43210",
      maskedPhone: "98765*****0",
      email: "contact@abcindustries.co.in",
      address: "Plot 42, MPCB MIDC Industrial Zone, Pune, Maharashtra - 411018",
      kycVerified: true,
      digilockerId: "DL-MH-2026-88129",
      registeredLandSurvey: "102"
    },
    {
      id: "USR-002",
      name: "Rajesh Infrastructure & Power Ltd",
      type: "BUSINESS",
      pan: "RJSHI5678K",
      aadhaar: "887766554433",
      authorizedPerson: "Rajesh Kumar (Managing Director)",
      phone: "+91 98123 45678",
      maskedPhone: "98123*****8",
      email: "rajesh@rajeshinfra.com",
      address: "Survey 103 Industrial Estate, Chakan, Pune, Maharashtra - 410501",
      kycVerified: true,
      digilockerId: "DL-MH-2026-54312",
      registeredLandSurvey: "103"
    },
    {
      id: "USR-003",
      name: "Priya Ramesh Sharma",
      type: "INDIVIDUAL",
      pan: "PRSHM9012L",
      aadhaar: "123456789012",
      authorizedPerson: "Priya Ramesh Sharma",
      phone: "+91 99001 12233",
      maskedPhone: "99001*****3",
      email: "priya.sharma@gmail.com",
      address: "Flat 402, Green Acres, Kothrud, Pune, Maharashtra - 411038",
      kycVerified: true,
      digilockerId: "DL-MH-2026-11209",
      registeredLandSurvey: "104"
    }
  ],

  // Land Department Data Store (Simulating Legacy Government Format)
  // Fields intentionally use regional/legacy terms:
  // gtn = Survey Number (Gat/Tika Number)
  // malak_name = Owner Name
  // malak_pan = Owner PAN
  // kshetra = Area
  // kshetra_unit = Area Unit (HA = Hectare)
  // jamabandi = Mutation Status (APPROVED, PENDING, REJECTED, UNDER_OBJECTION)
  // jamin_prakar = Land Category (INDUSTRIAL, AGRICULTURAL, COMMERCIAL, RESIDENTIAL)
  // bandhak = Encumbrance flag (true/false)
  // court_case = Legal dispute flag (true/false)
  landRecords: {
    "102": {
      gtn: "102",
      malak_name: "ABC Industries Pvt Ltd",
      malak_pan: "ABCDE1234F",
      kshetra: "12.5",
      kshetra_unit: "HA",
      jamabandi: "APPROVED",
      jamin_prakar: "INDUSTRIAL",
      bandhak: false,
      court_case: false,
      jilha: "Pune",
      taluka: "Haveli",
      gaw: "Pirangut",
      last_updated: "2026-08-15T10:30:00Z"
    },
    "103": {
      gtn: "103",
      malak_name: "Rajesh Infrastructure & Power Ltd",
      malak_pan: "RJSHI5678K",
      kshetra: "8.2",
      kshetra_unit: "HA",
      jamabandi: "PENDING", // Demonstrates State-Aware Polling and Waiting workflow
      jamin_prakar: "INDUSTRIAL",
      bandhak: false,
      court_case: false,
      jilha: "Pune",
      taluka: "Khed",
      gaw: "Chakan",
      last_updated: "2026-09-01T08:00:00Z"
    },
    "104": {
      gtn: "104",
      malak_name: "Priya Ramesh Sharma",
      malak_pan: "PRSHM9012L",
      kshetra: "3.0",
      kshetra_unit: "HA",
      jamabandi: "APPROVED",
      jamin_prakar: "AGRICULTURAL",
      bandhak: true, // Encumbered land
      court_case: false,
      jilha: "Pune",
      taluka: "Haveli",
      gaw: "Kothrud",
      last_updated: "2026-07-20T14:15:00Z"
    }
  },

  // In-Memory Active OTP sessions
  activeOtps: new Map(),

  // Simulated Audit Logs
  auditLogs: []
};
