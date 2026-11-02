export type ApplicationStatus = "applied" | "accepted" | "rejected" | "withdrawn";

// A listing the student may apply to, with what they already did about it.
export type StudentListing = {
  id: string;
  title: string;
  description: string | null;
  companyName: string;
  postedAt: string;
  // Set when the student already applied to this listing.
  applicationStatus: ApplicationStatus | null;
};

export type StudentApplication = {
  id: string;
  status: ApplicationStatus;
  listingTitle: string;
  companyName: string;
  appliedAt: string;
};

export type StudentSummary = {
  fullName: string;
  hasResume: boolean;
  openApplications: number;
  totalApplications: number;
  // Approved hours so far and the batch's required hours (0 when not known).
  approvedHours: number;
  requiredHours: number;
  // The company of the student's active deployment, if any.
  placement: string | null;
};
