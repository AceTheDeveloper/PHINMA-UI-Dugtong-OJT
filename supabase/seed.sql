-- Development data only. Never applied to production.
-- Names are fictional except the institution and the pilot department and course.

insert into departments (id, code, name) values
  ('00000000-0000-4000-8000-000000000001', 'CITE', 'College of Information Technology Education');

insert into courses (id, department_id, code, name) values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001',
   'BSIT', 'Bachelor of Science in Information Technology');

insert into ojt_batches (id, course_id, school_year, required_hours, status) values
  ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000011',
   '2026-2027', 300, 'active');

insert into companies (id, name) values
  ('00000000-0000-4000-8000-000000000031', 'Northwind Digital'),
  ('00000000-0000-4000-8000-000000000032', 'Bluepeak Software');
