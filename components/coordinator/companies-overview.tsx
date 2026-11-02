import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { companyRows, formatHours } from "@/lib/coordinator/metrics";
import type { DashboardCompany, DashboardStudent } from "@/lib/coordinator/types";

export function CompaniesOverview({
  companies,
  students,
}: {
  companies: DashboardCompany[];
  students: DashboardStudent[];
}) {
  const rows = companyRows(companies, students);

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-bold">
          Partner companies
        </CardTitle>
        <CardDescription>Students and approved hours per company.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Supervisors</TableHead>
              <TableHead className="text-right">Active students</TableHead>
              <TableHead className="text-right">Approved hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  No partner companies yet. The admin adds them.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map(({ company, activeStudents, approvedHours }) => (
              <TableRow key={company.id}>
                <TableCell className="font-semibold text-ink">{company.name}</TableCell>
                <TableCell className="text-right tabular-nums">{company.supervisors}</TableCell>
                <TableCell className="text-right tabular-nums">{activeStudents}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatHours(approvedHours)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
