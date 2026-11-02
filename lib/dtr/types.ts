// A daily time record: one deployment's approved entries, for the school's files.
// Deliberately minimal for now (FLAG-02): the student, the entries, the supervisor.

export type DtrEntry = {
  // School date (YYYY-MM-DD) of the entry.
  date: string;
  timeIn: string;
  timeOut: string;
  // Minutes worked, the break already taken off.
  minutes: number;
};

export type DtrData = {
  studentName: string;
  studentNumber: string;
  // The supervisor or supervisors who approved the entries.
  supervisorName: string | null;
  entries: DtrEntry[];
};

// What the download route needs to decide who may have the file.
export type DtrAccess = {
  studentId: string;
  companyId: string;
  courseId: string;
};
