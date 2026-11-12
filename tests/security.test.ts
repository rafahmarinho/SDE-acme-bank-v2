import { describe, expect, it } from "vitest";
import { csvCell, formatCents, toCsv } from "@/lib/csv";
import { safeHref, safeNext } from "@/lib/safe-url";

describe("safeNext (open redirect / DOM XSS)", () => {
  it.each([
    ["javascript:alert(1)", "/overview"],
    ["//evil.example", "/overview"],
    ["/\\evil.example", "/overview"],
    ["https://evil.example/x", "/overview"],
    ["", "/overview"],
    [null, "/overview"],
    ["/accounts?tab=2", "/accounts?tab=2"],
    ["/transfers", "/transfers"],
  ])("safeNext(%s) -> %s", (input, expected) => {
    expect(safeNext(input as string | null)).toBe(expected);
  });
});

describe("safeHref", () => {
  it("neutralises dangerous schemes", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("data:text/html,<script>")).toBe("#");
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
  });
});

describe("CSV formula injection", () => {
  it.each(["=1+1", "+cmd", "-2", "@SUM(A1)", "\t=x"])("neutralises %s", (value) => {
    expect(csvCell(value).startsWith(`"'`)).toBe(true);
  });
  it("quotes and escapes", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(toCsv(["a"], [["=HYPERLINK(1)"]])).toBe('"a"\r\n"\'=HYPERLINK(1)"\r\n');
  });
});

describe("formatCents", () => {
  it("formats integer cents exactly", () => {
    expect(formatCents(123456)).toBe("1234.56");
    expect(formatCents(5)).toBe("0.05");
    expect(formatCents(-150)).toBe("-1.50");
  });
});
