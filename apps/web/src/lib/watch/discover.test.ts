import { describe, expect, it } from "vitest";
import { directCandidate, extractCandidateLinks } from "./discover";

const BASE = "https://www.rbi.org.in/Scripts/BS_ViewMasterDirections.aspx";
const DOMAINS = ["rbi.org.in"];

describe("extractCandidateLinks", () => {
  it("keeps allow-listed links that match the pattern and de-duplicates", () => {
    const html = `
      <a href="/Scripts/BS_ViewMasDirections.aspx?id=12562">A</a>
      <a href='https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12562#x'>dup</a>
      <a href="https://evil.example.com/Scripts/BS_ViewMasDirections.aspx?id=9">bad</a>
      <a href="javascript:void(0)">js</a>
      <a href="/Scripts/BS_ViewMasDirections.aspx?id=12799">B</a>
    `;

    const links = extractCandidateLinks(html, BASE, {
      allowedDomains: DOMAINS,
      linkPattern: "ViewMasDirections\\.aspx\\?id=",
    });

    expect(links).toEqual([
      "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12562",
      "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12799",
    ]);
  });

  it("uses a default keyword/PDF filter when no pattern is given", () => {
    const html = `
      <a href="/a.pdf">pdf</a>
      <a href="/legal/circular-2026">circular</a>
      <a href="/about-us">noise</a>
    `;

    const links = extractCandidateLinks(html, BASE, { allowedDomains: DOMAINS });
    expect(links).toHaveLength(2);
    expect(links[0]).toContain("a.pdf");
    expect(links[1]).toContain("circular-2026");
  });

  it("caps results and tolerates an invalid regex", () => {
    const html = Array.from(
      { length: 5 },
      (_, index) => `<a href="/doc-${index}.pdf">x</a>`,
    ).join("");
    expect(extractCandidateLinks(html, BASE, { allowedDomains: DOMAINS, max: 2 })).toHaveLength(2);
    expect(
      extractCandidateLinks(html, BASE, { allowedDomains: DOMAINS, linkPattern: "(" }),
    ).toHaveLength(0);
  });
});

describe("directCandidate", () => {
  it("returns the URL when it is allow-listed", () => {
    expect(directCandidate(BASE, DOMAINS)).toEqual([BASE]);
    expect(directCandidate(BASE, ["sebi.gov.in"])).toEqual([]);
    expect(directCandidate("http://localhost/x", DOMAINS)).toEqual([]);
  });
});
