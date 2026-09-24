import { describe, expect, it } from "vitest";
import { schoolFormSchema, toSchoolPayload } from "@/schemas/school";
import { createUserFormSchema, editUserFormSchema } from "@/schemas/user";

const school = { name: "Greenfield", code: "GF1", status: "ACTIVE" as const };

describe("school form schema", () => {
  it("accepts a minimal school and nulls out cleared fields", () => {
    const parsed = schoolFormSchema.parse({ ...school, email: "", city: "  ", establishedYear: "1998" });
    const payload = toSchoolPayload(parsed);
    expect(payload.email).toBeNull();
    expect(payload.city).toBeNull();
    expect(payload.establishedYear).toBe(1998);
  });

  it("rejects bad email, year and logo URL", () => {
    const r = schoolFormSchema.safeParse({ ...school, email: "nope", establishedYear: "98", logoUrl: "x" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["email", "establishedYear", "logoUrl"]));
  });
});

describe("user form schema", () => {
  const base = { firstName: "A", lastName: "B", email: "a@b.co", role: "TEACHER" as const, status: "ACTIVE" as const, extraPermissions: [] };

  it("requires a strong password on create", () => {
    expect(createUserFormSchema.safeParse({ ...base, schoolId: "s1", password: "weak" }).success).toBe(false);
    expect(createUserFormSchema.safeParse({ ...base, schoolId: "s1", password: "Strong123" }).success).toBe(true);
  });

  it("requires a school for school-level roles but not for SUPER_ADMIN", () => {
    expect(editUserFormSchema.safeParse({ ...base, schoolId: "" }).success).toBe(false);
    expect(editUserFormSchema.safeParse({ ...base, role: "SUPER_ADMIN", schoolId: "" }).success).toBe(true);
  });
});
