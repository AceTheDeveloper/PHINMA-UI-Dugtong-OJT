// Mock data for the coordinator dashboard (ticket-05).
// Every name, ID, and company here is fictional. Replace this module with real
// data access later; components read only from the shapes exported below.

export type StudentStatus =
  | "active"
  | "ready"
  | "completed"
  | "applying"
  | "no-application"
  | "ended";

export type MockStudent = {
  id: string;
  name: string;
  studentNumber: string;
  companyId: string | null;
  status: StudentStatus;
  approvedHours: number;
  pendingEntries: number;
  lastEntryDate: string | null;
};

export type MockCompany = {
  id: string;
  name: string;
  supervisors: number;
};

export type MockPendingEntry = {
  id: string;
  studentId: string;
  date: string;
  daysWaiting: number;
};

export type MockOpenEntry = {
  id: string;
  studentId: string;
  date: string;
};

export type MockActivity = {
  id: string;
  text: string;
  at: string;
};

export const mockCoordinator = {
  name: "Coordinator Sample",
  role: "Coordinator",
};

export const mockCourse = {
  school: "PHINMA University of Iloilo",
  department: "College of Information Technology Education",
  departmentShort: "CITE",
  course: "Bachelor of Science in Information Technology",
  courseShort: "BSIT",
  requiredHours: 300,
  staleThresholdDays: 3,
  asOf: "2026-11-01",
};

export const mockCompanies: MockCompany[] = [
  { id: "c1", name: "Northwind Digital", supervisors: 2 },
  { id: "c2", name: "Bluepeak Software", supervisors: 1 },
  { id: "c3", name: "Harbor Analytics", supervisors: 3 },
  { id: "c4", name: "Kawayan Labs", supervisors: 1 },
  { id: "c5", name: "Tindahan Tech", supervisors: 1 },
];

export const mockStudents: MockStudent[] = [
  { id: "s01", name: "Ana Sample", studentNumber: "MOCK-0001", companyId: "c1", status: "active", approvedHours: 120, pendingEntries: 1, lastEntryDate: "2026-10-31" },
  { id: "s02", name: "Ben Mockton", studentNumber: "MOCK-0002", companyId: "c2", status: "active", approvedHours: 240, pendingEntries: 0, lastEntryDate: "2026-10-31" },
  { id: "s03", name: "Cara Demo", studentNumber: "MOCK-0003", companyId: "c3", status: "active", approvedHours: 0, pendingEntries: 0, lastEntryDate: "2026-10-30" },
  { id: "s04", name: "Dino Testa", studentNumber: "MOCK-0004", companyId: "c1", status: "ready", approvedHours: 300, pendingEntries: 0, lastEntryDate: "2026-10-29" },
  { id: "s05", name: "Ella Placeholder", studentNumber: "MOCK-0005", companyId: "c2", status: "ready", approvedHours: 312.5, pendingEntries: 0, lastEntryDate: "2026-10-28" },
  { id: "s06", name: "Finn Sample", studentNumber: "MOCK-0006", companyId: "c3", status: "completed", approvedHours: 304, pendingEntries: 0, lastEntryDate: "2026-10-20" },
  { id: "s07", name: "Gia Mockton", studentNumber: "MOCK-0007", companyId: null, status: "applying", approvedHours: 0, pendingEntries: 0, lastEntryDate: null },
  { id: "s08", name: "Hugo Demo", studentNumber: "MOCK-0008", companyId: null, status: "applying", approvedHours: 0, pendingEntries: 0, lastEntryDate: null },
  { id: "s09", name: "Iris Testa", studentNumber: "MOCK-0009", companyId: null, status: "no-application", approvedHours: 0, pendingEntries: 0, lastEntryDate: null },
  { id: "s10", name: "Jon Placeholder", studentNumber: "MOCK-0010", companyId: "c4", status: "ended", approvedHours: 85, pendingEntries: 0, lastEntryDate: "2026-09-30" },
  { id: "s11", name: "Kai Sample", studentNumber: "MOCK-0011", companyId: "c1", status: "active", approvedHours: 180, pendingEntries: 3, lastEntryDate: "2026-10-31" },
  { id: "s12", name: "Lia Mockton", studentNumber: "MOCK-0012", companyId: "c4", status: "active", approvedHours: 60, pendingEntries: 2, lastEntryDate: "2026-10-30" },
  { id: "s13", name: "Mio Demo", studentNumber: "MOCK-0013", companyId: null, status: "no-application", approvedHours: 0, pendingEntries: 0, lastEntryDate: null },
  { id: "s14", name: "Nina Testa", studentNumber: "MOCK-0014", companyId: "c3", status: "active", approvedHours: 270, pendingEntries: 0, lastEntryDate: "2026-10-31" },
];

export const mockPendingEntries: MockPendingEntry[] = [
  { id: "p1", studentId: "s11", date: "2026-10-26", daysWaiting: 6 },
  { id: "p2", studentId: "s11", date: "2026-10-27", daysWaiting: 5 },
  { id: "p3", studentId: "s12", date: "2026-10-28", daysWaiting: 4 },
  { id: "p4", studentId: "s11", date: "2026-10-30", daysWaiting: 2 },
  { id: "p5", studentId: "s12", date: "2026-10-31", daysWaiting: 1 },
  { id: "p6", studentId: "s01", date: "2026-10-31", daysWaiting: 1 },
];

export const mockOpenEntries: MockOpenEntry[] = [
  { id: "o1", studentId: "s03", date: "2026-10-28" },
];

export const mockActivity: MockActivity[] = [
  { id: "a1", text: "Supervisor at Northwind Digital approved 12 entries.", at: "2026-10-31T17:40:00+08:00" },
  { id: "a2", text: "Supervisor at Harbor Analytics submitted an evaluation.", at: "2026-10-31T15:05:00+08:00" },
  { id: "a3", text: "Required hours for the course were changed.", at: "2026-10-30T10:12:00+08:00" },
  { id: "a4", text: "Supervisor at Bluepeak Software rejected 1 entry.", at: "2026-10-30T09:30:00+08:00" },
  { id: "a5", text: "A supervisor accepted an applicant at Kawayan Labs.", at: "2026-10-29T14:20:00+08:00" },
];
