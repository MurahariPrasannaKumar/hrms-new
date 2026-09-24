import { z } from "zod";

const optionalText = z.string().trim().max(255).optional();

export const schoolFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  code: z.string().trim().min(2, "Code must be at least 2 characters").max(30),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
  phone: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
  postalCode: optionalText,
  principal: optionalText,
  establishedYear: z
    .union([z.literal(""), z.string().regex(/^\d{4}$/, "Enter a 4-digit year")])
    .optional(),
  logoUrl: z.union([z.literal(""), z.string().trim().url("Enter a valid URL")]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type SchoolFormValues = z.infer<typeof schoolFormSchema>;

/** Empty strings become null so cleared fields are actually cleared server-side. */
export function toSchoolPayload(v: SchoolFormValues) {
  const text = (s?: string) => (s && s.trim() !== "" ? s.trim() : null);
  return {
    name: v.name,
    code: v.code,
    email: text(v.email),
    phone: text(v.phone),
    address: text(v.address),
    city: text(v.city),
    state: text(v.state),
    country: text(v.country),
    postalCode: text(v.postalCode),
    principal: text(v.principal),
    establishedYear: v.establishedYear ? Number(v.establishedYear) : null,
    logoUrl: text(v.logoUrl),
    status: v.status,
  };
}
