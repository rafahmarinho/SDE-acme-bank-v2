import { describe, expect, it } from "vitest";
import { navFor } from "@/components/app/nav-config";
import { POLICY } from "@/lib/authz";
import { formatMoney, parseAmountToCents } from "@/lib/money";
import { escapeLike, LedgerSearch } from "@/services/accounts.service";
import { SimAction } from "@/services/simulation.service";
import { StatementRequest } from "@/services/statements.service";

describe("money in integer cents", () => {
  it.each([
    ["12", 1200], ["12.3", 1230], ["12.34", 1234], ["0.01", 1], ["1,234.56", 123456], ["$ 99.99", 9999], ["9999999.99", 999999999],
  ])("parses %s -> %d", (input, cents) => expect(parseAmountToCents(input)).toBe(cents));
  it.each(["", "0", "0.00", "-5", "1.234", "abc", "1e5", "10000000", "12.", ".5"])("rejects %s", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
  it("formats exactly, without float drift", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(-150)).toBe("-$1.50");
    expect(formatMoney(1, { signed: true })).toBe("+$0.01");
    expect(formatMoney(999999999)).toBe("$9,999,999.99");
  });
});

describe("authorization policy (deny by default, T184/T338)", () => {
  type Roles = readonly string[] | undefined;
  const can = (res: keyof typeof POLICY, method: string, role: string) =>
    ((POLICY[res] as Record<string, Roles>)[method] ?? []).includes(role);

  it("keeps customers out of staff, audit and simulation endpoints", () => {
    expect(can("staff/customers", "GET", "customer")).toBe(false);
    expect(can("staff/restrictions", "POST", "customer")).toBe(false);
    expect(can("staff/audit", "GET", "customer")).toBe(false);
    expect(can("simulation", "POST", "customer")).toBe(false);
    expect(can("users:role", "PATCH", "customer")).toBe(false);
  });
  it("keeps support away from money movement, simulation and role changes", () => {
    for (const r of ["transfers", "scheduled-payments", "beneficiaries", "statements"] as const) expect(can(r, "POST", "support")).toBe(false);
    expect(can("cards/:id", "PATCH", "support")).toBe(false);
    expect(can("simulation", "POST", "support")).toBe(false);
    expect(can("staff/audit", "GET", "support")).toBe(false);
    expect(can("users:role", "PATCH", "support")).toBe(false);
  });
  it("allows admin management functions only to admin", () => {
    expect(can("simulation", "POST", "admin")).toBe(true);
    expect(can("users:role", "PATCH", "admin")).toBe(true);
    expect(can("staff/audit", "GET", "admin")).toBe(true);
  });
  it("denies unlisted methods", () => {
    expect(can("transfers", "DELETE", "customer")).toBe(false);
    expect(can("statements/:id", "DELETE", "customer")).toBe(false);
  });
});

describe("navigation is derived from the role (cosmetic only, T17)", () => {
  it("shows staff and simulation entries only to the right roles", () => {
    const hrefs = (role: "customer" | "support" | "admin", sim = true) => navFor(role, sim).main.map((i) => i.href);
    expect(hrefs("customer")).not.toContain("/staff");
    expect(hrefs("support")).not.toContain("/simulation");
    expect(hrefs("support")).not.toContain("/staff/audit");
    expect(hrefs("admin")).toContain("/simulation");
    expect(hrefs("admin", false)).not.toContain("/simulation");
  });
});

describe("server-side selection uses allow-lists and bounds (T42)", () => {
  it("rejects unknown scenarios and unbounded day counts", () => {
    expect(SimAction.safeParse({ action: "apply", scenario: "../../etc/passwd" }).success).toBe(false);
    expect(SimAction.safeParse({ action: "advance", days: 32 }).success).toBe(false);
    expect(SimAction.safeParse({ action: "advance", days: 0 }).success).toBe(false);
    expect(SimAction.safeParse({ action: "drop_tables" }).success).toBe(false);
    expect(SimAction.safeParse({ action: "apply", scenario: "purchases" }).success).toBe(true);
  });
  it("only allows csv/pdf statements of up to 366 days", () => {
    const base = { accountId: "6f1e7c2a-1b2c-4d3e-8f90-123456789abc", periodStart: "2026-01-01", periodEnd: "2026-01-31" };
    expect(StatementRequest.safeParse({ ...base, format: "pdf" }).success).toBe(true);
    expect(StatementRequest.safeParse({ ...base, format: "xlsx" }).success).toBe(false);
    expect(StatementRequest.safeParse({ ...base, periodEnd: "2027-06-01", format: "csv" }).success).toBe(false);
  });
});

describe("search input is bounded and LIKE-escaped (T38, T2600)", () => {
  it("escapes wildcards", () => expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\"));
  it("caps page size and validates enums", () => {
    const id = "6f1e7c2a-1b2c-4d3e-8f90-123456789abc";
    expect(LedgerSearch.safeParse({ accountId: id, limit: 500 }).success).toBe(false);
    expect(LedgerSearch.safeParse({ accountId: id, direction: "debit' OR 1=1 --" }).success).toBe(false);
    expect(LedgerSearch.safeParse({ accountId: id, text: "x".repeat(101) }).success).toBe(false);
    expect(LedgerSearch.parse({ accountId: id }).limit).toBe(25);
  });
});
