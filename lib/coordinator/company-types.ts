// Partner companies as the coordinator sees them. Read only: the admin manages
// companies. Supervisors show name and email only, because the coordinator needs
// to reach them and nothing more.

export type CompanyStatus = "active" | "inactive";

export type CompanyRow = {
  id: string;
  name: string;
  status: CompanyStatus;
  // The owner, the named point of contact; null when none is set.
  ownerName: string | null;
  supervisors: number;
  // Listings open to the coordinator's course.
  openListings: number;
  // The course's students on an active deployment here.
  activeStudents: number;
  approvedHours: number;
};

export type CompaniesView = {
  course: { courseShort: string; batchLabel: string; requiredHours: number };
  companies: CompanyRow[];
};

export type CompanySupervisor = { name: string; email: string; isOwner: boolean; isActive: boolean };

export type CompanyListing = { id: string; title: string; status: "open" | "closed"; postedAt: string };

export type CompanyStudent = {
  studentId: string;
  name: string;
  studentNumber: string;
  deploymentId: string;
  status: "active" | "completed" | "ended";
  approvedHours: number;
};

export type CompanyView = {
  course: { courseShort: string; batchLabel: string; requiredHours: number };
  company: { id: string; name: string; address: string | null; status: CompanyStatus };
  supervisors: CompanySupervisor[];
  listings: CompanyListing[];
  students: CompanyStudent[];
};
