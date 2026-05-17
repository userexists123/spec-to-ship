import {
  AcceptanceCriterion,
  BacklogBundle,
  Epic,
  Requirement,
  Risk,
  SourceReference,
  Story
} from "../schemas/backlog";

type SectionMap = Record<string, string[]>;

const KNOWN_COLON_HEADERS = new Set([
  "prd title",
  "title",
  "project title",
  "project charter",
  "overview",
  "background",
  "problem",
  "purpose",
  "goals",
  "objectives",
  "scope",
  "requirements",
  "functional requirements",
  "non functional requirements",
  "non-functional requirements",
  "acceptance criteria",
  "user stories",
  "features",
  "prototype goals",
  "risks and assumptions",
  "risks",
  "assumptions",
  "dependencies",
  "frontend"
]);

const REQUIREMENT_SECTIONS = [
  "Requirements",
  "Functional Requirements",
  "Non-Functional Requirements",
  "Goals",
  "Objectives",
  "Scope",
  "Prototype Goals",
  "Features",
  "User Stories"
];

const CONTEXT_SECTIONS = ["Problem", "Purpose", "Overview", "Background", "Frontend"];

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function canonicalSectionName(value: string): string {
  const normalized = normalizeLine(value).toLowerCase();

  if (normalized === "prd title" || normalized === "title" || normalized === "project title") {
    return "Project Title";
  }

  if (normalized === "project charter") {
    return "Project Charter";
  }

  if (normalized === "overview") {
    return "Overview";
  }

  if (normalized === "background") {
    return "Background";
  }

  if (normalized === "problem") {
    return "Problem";
  }

  if (normalized === "purpose") {
    return "Purpose";
  }

  if (normalized === "goals") {
    return "Goals";
  }

  if (normalized === "objectives") {
    return "Objectives";
  }

  if (normalized === "scope") {
    return "Scope";
  }

  if (normalized === "requirements") {
    return "Requirements";
  }

  if (normalized === "functional requirements") {
    return "Functional Requirements";
  }

  if (normalized === "non functional requirements" || normalized === "non-functional requirements") {
    return "Non-Functional Requirements";
  }

  if (normalized === "acceptance criteria") {
    return "Acceptance Criteria";
  }

  if (normalized === "user stories") {
    return "User Stories";
  }

  if (normalized === "features") {
    return "Features";
  }

  if (normalized === "prototype goals") {
    return "Prototype Goals";
  }

  if (normalized === "risks and assumptions" || normalized === "risks" || normalized === "assumptions") {
    return "Risks and Assumptions";
  }

  if (normalized === "dependencies") {
    return "Dependencies";
  }

  if (normalized.startsWith("frontend")) {
    return "Frontend";
  }

  return normalizeLine(value);
}

function parseSections(prdText: string): SectionMap {
  const sections: SectionMap = {};
  const lines = prdText.split(/\r?\n/);
  let currentSection = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const markdownHeaderMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (markdownHeaderMatch) {
      const level = markdownHeaderMatch[1].length;
      const headerText = normalizeLine(markdownHeaderMatch[2]);
      const inlineTitleMatch = headerText.match(/^([^:]+):\s*(.+)$/);

      if (level === 1 && !inlineTitleMatch) {
        currentSection = "Project Title";
        sections[currentSection] ??= [];
        sections[currentSection].push(headerText);
        continue;
      }

      if (inlineTitleMatch) {
        const headerName = normalizeLine(inlineTitleMatch[1]);
        const trailingValue = normalizeLine(inlineTitleMatch[2]);

        currentSection = canonicalSectionName(headerName);
        sections[currentSection] ??= [];

        if (trailingValue) {
          sections[currentSection].push(trailingValue);
        }

        continue;
      }

      currentSection = canonicalSectionName(headerText);
      sections[currentSection] ??= [];
      continue;
    }

    const colonHeaderMatch = line.match(/^([A-Za-z][A-Za-z0-9 /&()\-]+):\s*(.*)$/);
    if (colonHeaderMatch) {
      const rawHeaderName = normalizeLine(colonHeaderMatch[1]);
      const trailingValue = normalizeLine(colonHeaderMatch[2] || "");

      if (KNOWN_COLON_HEADERS.has(rawHeaderName.toLowerCase())) {
        currentSection = canonicalSectionName(rawHeaderName);
        sections[currentSection] ??= [];

        if (trailingValue) {
          sections[currentSection].push(trailingValue);
        }

        continue;
      }
    }

    if (currentSection) {
      sections[currentSection].push(normalizeLine(line));
    }
  }

  return sections;
}

function getSection(sections: SectionMap, name: string): string[] {
  return sections[name] || [];
}

function stripBulletPrefix(value: string): string {
  return value.replace(/^[-*]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function isListItem(line: string): boolean {
  return /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeLine(value)).filter(Boolean)));
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractProjectTitle(sections: SectionMap): string {
  const explicitTitle = getSection(sections, "Project Title");
  if (explicitTitle.length > 0) {
    return explicitTitle[0];
  }

  const charter = getSection(sections, "Project Charter");
  if (charter.length > 0) {
    return charter[0];
  }

  return "Untitled Project";
}

function findSourceRefs(section: string, lines: string[], terms: string[]): SourceReference[] {
  const refs: SourceReference[] = [];

  for (const term of terms) {
    const match = lines.find((line) => line.toLowerCase().includes(term.toLowerCase()));

    if (match) {
      refs.push({
        section,
        excerpt: match
      });
    }
  }

  return refs;
}

function extractRequirementItemsFromSectionLines(lines: string[]): string[] {
  const listItems = lines.filter(isListItem).map(stripBulletPrefix);

  if (listItems.length > 0) {
    return listItems;
  }

  return lines
    .filter((line) => !line.endsWith(":"))
    .map(stripBulletPrefix)
    .filter((line) => {
      const lower = line.toLowerCase();

      return (
        lower.includes(" must ") ||
        lower.startsWith("must ") ||
        lower.includes(" should ") ||
        lower.startsWith("should ") ||
        lower.includes(" need ") ||
        lower.includes(" needs ") ||
        lower.includes(" required") ||
        lower.includes(" requirement") ||
        lower.startsWith("the system ") ||
        lower.startsWith("the workspace ") ||
        lower.startsWith("users ") ||
        lower.startsWith("the pm ") ||
        lower.startsWith("pm ")
      );
    });
}

function extractRequirementItems(sections: SectionMap): Array<{ section: string; text: string }> {
  const items: Array<{ section: string; text: string }> = [];

  for (const section of REQUIREMENT_SECTIONS) {
    for (const item of extractRequirementItemsFromSectionLines(getSection(sections, section))) {
      items.push({ section, text: item });
    }
  }

  return dedupe(items.map((item) => `${item.section}\u0000${item.text}`)).map((value) => {
    const [section, text] = value.split("\u0000");
    return { section, text };
  });
}

function summarizeRequirement(text: string): string {
  const cleaned = stripBulletPrefix(text).replace(/\.$/, "").trim();

  if (!cleaned) {
    return "Requirement summary unavailable.";
  }

  const lower = cleaned.toLowerCase();

  if (
    lower.startsWith("build ") ||
    lower.startsWith("create ") ||
    lower.startsWith("edit ") ||
    lower.startsWith("search ") ||
    lower.startsWith("view ") ||
    lower.startsWith("show ") ||
    lower.startsWith("capture ") ||
    lower.startsWith("let ") ||
    lower.startsWith("allow ") ||
    lower.startsWith("enable ") ||
    lower.startsWith("the system") ||
    lower.startsWith("the workspace") ||
    lower.startsWith("the pm")
  ) {
    return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
  }

  return `System supports ${cleaned}.`;
}

function classifyPriority(text: string): "high" | "medium" | "low" {
  const value = text.toLowerCase();

  if (
    value.includes("validate") ||
    value.includes("live") ||
    value.includes("stream") ||
    value.includes("pipeline") ||
    value.includes("integration") ||
    value.includes("compare") ||
    value.includes("persist") ||
    value.includes("security") ||
    value.includes("required")
  ) {
    return "high";
  }

  if (value.includes("audit") || value.includes("history") || value.includes("search") || value.includes("status")) {
    return "medium";
  }

  return "medium";
}

function buildRequirements(sections: SectionMap): Requirement[] {
  const requirementItems = extractRequirementItems(sections);
  const contextLines = CONTEXT_SECTIONS.flatMap((section) => getSection(sections, section));

  return requirementItems.map((item, index) => {
    const id = `REQ-${String(index + 1).padStart(3, "0")}`;
    const title = titleCase(stripBulletPrefix(item.text).replace(/\.$/, ""));
    const summary = summarizeRequirement(item.text);
    const searchTerms = item.text.split(" ").slice(0, 4);

    const sourceRefs: SourceReference[] = [
      {
        section: item.section,
        excerpt: item.text
      },
      ...findSourceRefs("Problem/Purpose/Overview", contextLines, searchTerms)
    ];

    return {
      id,
      title,
      summary,
      priority: classifyPriority(item.text),
      source_refs: sourceRefs.length > 0 ? sourceRefs : [{ section: item.section, excerpt: item.text }]
    };
  });
}

function buildEpics(requirements: Requirement[]): Epic[] {
  return requirements.map((requirement, index) => ({
    id: `EPIC-${String(index + 1).padStart(3, "0")}`,
    title: requirement.title,
    summary: requirement.summary,
    requirement_ids: [requirement.id],
    source_refs: requirement.source_refs
  }));
}

function buildAcceptanceCriteria(issueId: string, requirement: Requirement): AcceptanceCriterion[] {
  const index = issueId.split("-")[1];

  return [
    {
      id: `AC-${index}-001`,
      story_id: issueId,
      text: `${requirement.title} is represented in the generated backlog output.`
    },
    {
      id: `AC-${index}-002`,
      story_id: issueId,
      text: `${requirement.id} remains linked to its issue and source references across repeated runs.`
    }
  ];
}

function buildStories(requirements: Requirement[], epics: Epic[]): Story[] {
  return requirements.map((requirement, index) => {
    const issueId = `ISSUE-${String(index + 1).padStart(3, "0")}`;

    return {
      id: issueId,
      epic_id: epics[index].id,
      title: requirement.title,
      summary: requirement.summary,
      requirement_ids: [requirement.id],
      acceptance_criteria: buildAcceptanceCriteria(issueId, requirement),
      source_refs: requirement.source_refs
    };
  });
}

function buildRisks(sections: SectionMap, requirements: Requirement[]): Risk[] {
  const riskLines = getSection(sections, "Risks and Assumptions");
  const dependencyLines = getSection(sections, "Dependencies");
  const risks: Risk[] = [];

  for (const [index, riskLine] of riskLines.map(stripBulletPrefix).filter(Boolean).entries()) {
    risks.push({
      id: `RISK-${String(index + 1).padStart(3, "0")}`,
      title: titleCase(riskLine.replace(/\.$/, "")),
      severity: index === 0 ? "high" : "medium",
      related_requirement_ids: requirements.slice(0, Math.min(4, requirements.length)).map((item) => item.id),
      mitigation_note: riskLine
    });
  }

  if (dependencyLines.length > 0) {
    const dependencyExcerpt = dependencyLines.find((line) => !line.endsWith(":")) || dependencyLines[0];

    risks.push({
      id: `RISK-${String(risks.length + 1).padStart(3, "0")}`,
      title: "External Dependencies May Delay Delivery",
      severity: "medium",
      related_requirement_ids: requirements.slice(0, Math.min(3, requirements.length)).map((item) => item.id),
      mitigation_note: stripBulletPrefix(dependencyExcerpt)
    });
  }

  return risks;
}

export function parsePrdToBacklog(prdText: string, prdId = "prd-golden"): BacklogBundle {
  const sections = parseSections(prdText);
  const requirements = buildRequirements(sections);
  const epics = buildEpics(requirements);
  const stories = buildStories(requirements, epics);
  const risks = buildRisks(sections, requirements);

  return {
    prd_id: prdId,
    title: extractProjectTitle(sections),
    requirements,
    epics,
    stories,
    risks
  };
}