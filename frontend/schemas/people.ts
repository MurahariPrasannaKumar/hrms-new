import { z } from "zod";

const optional = z.string().trim().optional();

export const studentSchema = z.object({
  admissionNumber: z.string().trim().min(1, "Admission number is required"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  dateOfBirth: optional,
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: optional,
  address: optional,
  parentId: optional,
  classId: optional,
  sectionId: optional,
  admissionDate: optional,
  status: z.enum(["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"]),
});
export type StudentFormValues = z.infer<typeof studentSchema>;

export const teacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  employeeId: z.string().trim().min(1, "Employee ID is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().optional(),
  phone: optional,
  qualification: optional,
  joiningDate: optional,
});
export type TeacherFormValues = z.infer<typeof teacherSchema>;

export const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number");
