import { describe, expect, it } from "vitest";
import { getInitials } from "./avatar";

describe("getInitials", () => {
  it("extracts initials cleanly", () => {
    expect(getInitials("Meera Krishnan")).toBe("MK");
    expect(getInitials("Arjun")).toBe("AR");
    expect(getInitials("  Nikhil   Kumar   Rao ")).toBe("NR");
    expect(getInitials("")).toBe("?");
  });
});
