import { describe, expect, it } from "vitest";
import { groupSearch } from "@/lib/api/search";

const raw = {
  students: [{ id: "s1", firstName: "Aarav", lastName: "Sharma", admissionNumber: "GF1" }],
  teachers: [],
  schools: [{ id: "sc1", name: "Greenfield", code: "SCH-ONE", city: "Bengaluru" }],
  notices: [{ id: "n1", title: "Annual Day", type: "EVENT" }],
  courses: [],
  resources: [{ id: "r1", title: "Deck", type: "PRESENTATION", area: "pedagogy", category: "Math" }],
};

describe("groupSearch", () => {
  it("drops empty categories and builds role-scoped hrefs", () => {
    const groups = groupSearch(raw, "TEACHER");
    expect(groups.map((g) => g.key)).toEqual(["students", "schools", "notices", "resources"]);
    expect(groups[0].items[0]).toMatchObject({ label: "Aarav Sharma", href: "/teacher/students" });
    expect(groups[2].items[0].href).toBe("/teacher/noticeboard");
    expect(groups[3].items[0].href).toBe("/teacher/pedagogy");
  });

  it("links schools to the admin detail page", () => {
    expect(groupSearch(raw, "SUPER_ADMIN")[1].items[0].href).toBe("/admin/schools/sc1");
  });
});
