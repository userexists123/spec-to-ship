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

  if (normalized === "purpose") {
    return "Purpose";
  }

  if (normalized === "scope") {
    return "Scope";
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

    const markdownHeaderMatch = line.match(/^##\s+(.+)$/);
    if (markdownHeaderMatch) {
      currentSection = canonicalSectionName(markdownHeaderMatch[1]);
      sections[currentSection] ??= [];
      continue;
    }

    const colonHeaderMatch = line.match(/^([A-Za-z][A-Za-z0-9 /&()\-]+):\s*(.*)$/);
    if (colonHeaderMatch) {
      const sectionName = canonicalSectionName(colonHeaderMatch[1]);
      const trailingValue = normalizeLine(colonHeaderMatch[2] || "");

      currentSection = sectionName;
      sections[currentSection] ??= [];

      if (trailingValue) {
        sections[currentSection].push(trailingValue);
      }

      continue;
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
  return value.replace(/^[-*]\s+/, "").trim();
}

function isListItem(line: string): boolean {
  return /^[-*]\s+/.test(line);
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

function extractPurposeItems(sections: SectionMap): string[] {
  const purpose = getSection(sections, "Purpose");
  const scope = getSection(sections, "Scope");

  const purposeListItems = purpose.filter(isListItem).map(stripBulletPrefix);
  if (purposeListItems.length > 0) {
    return dedupe(purposeListItems);
  }

  const scopeListItems = scope.filter(isListItem).map(stripBulletPrefix);

  const purposeNonHeaderLines = purpose
    .filter((line) => !isListItem(line))
    .filter((line) => !line.endsWith(":"))
    .map(stripBulletPrefix);

  const combined = [...purposeNonHeaderLines, ...scopeListItems];

  if (combined.length > 0) {
    return dedupe(combined);
  }

  return dedupe(purpose.map(stripBulletPrefix));
}

function summarizeRequirement(text: string): string {
  const cleaned = stripBulletPrefix(text).replace(/\.$/, "").trim();

  if (!cleaned) {
    return "Requirement summary unavailable.";
  }

  const lower = cleaned.toLowerCase();

  if (lower.startsWith("build ") || lower.startsWith("create ") || lower.startsWith("edit ") || lower.startsWith("search ") || lower.startsWith("view ")) {
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
    value.includes("compare")
  ) {
    return "high";
  }

  if (
    value.includes("audit") ||
    value.includes("history") ||
    value.includes("search")
  ) {
    return "medium";
  }

  return "medium";
}

function buildRequirements(sections: SectionMap): Requirement[] {
  const purposeItems = extractPurposeItems(sections);
  const prototypeGoals = getSection(sections, "Prototype Goals");
  const scope = getSection(sections, "Scope");
  const frontendLines = getSection(sections, "Frontend");

  return purposeItems.map((item, index) => {
    const id = `REQ-${String(index + 1).padStart(3, "0")}`;
    const title = titleCase(stripBulletPrefix(item).replace(/\.$/, ""));
    const summary = summarizeRequirement(item);

    const searchTerms = item.split(" ").slice(0, 4);

    const sourceRefs: SourceReference[] = [
      {
        section: "Purpose",
        excerpt: item
      },
      ...findSourceRefs("Prototype Goals", prototypeGoals, searchTerms),
      ...findSourceRefs("Scope", scope, searchTerms),
      ...findSourceRefs("Frontend", frontendLines, searchTerms)
    ];

    return {
      id,
      title,
      summary,
      priority: classifyPriority(item),
      source_refs: sourceRefs.length > 0 ? sourceRefs : [{ section: "Purpose", excerpt: item }]
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

function buildAcceptanceCriteria(storyId: string, requirement: Requirement): AcceptanceCriterion[] {
  const index = storyId.split("-")[1];

  return [
    {
      id: `AC-${index}-001`,
      story_id: storyId,
      text: `${requirement.title} is represented in the generated backlog output.`
    },
    {
      id: `AC-${index}-002`,
      story_id: storyId,
      text: `${requirement.id} remains linked to its story and source references across repeated runs.`
    }
  ];
}

function buildStories(requirements: Requirement[], epics: Epic[]): Story[] {
  return requirements.map((requirement, index) => {
    const storyId = `STORY-${String(index + 1).padStart(3, "0")}`;

    return {
      id: storyId,
      epic_id: epics[index].id,
      title: requirement.title,
      summary: requirement.summary,
      requirement_ids: [requirement.id],
      acceptance_criteria: buildAcceptanceCriteria(storyId, requirement),
      source_refs: requirement.source_refs
    };
  });
}

function buildRisks(sections: SectionMap, requirements: Requirement[]): Risk[] {
  const riskLines = getSection(sections, "Risks and Assumptions");
  const dependencyLines = getSection(sections, "Dependencies");
  const risks: Risk[] = [];

  if (riskLines.length > 0) {
    risks.push({
      id: "RISK-001",
      title: titleCase(stripBulletPrefix(riskLines[0]).replace(/\.$/, "")),
      severity: "high",
      related_requirement_ids: requirements.slice(0, Math.min(4, requirements.length)).map((item) => item.id),
      mitigation_note: riskLines[0]
    });
  }

  if (dependencyLines.length > 0) {
    const dependencyExcerpt = dependencyLines.find((line) => !line.endsWith(":")) || dependencyLines[0];

    risks.push({
      id: "RISK-002",
      title: "External Dependencies May Delay Delivery",
      severity: "medium",
      related_requirement_ids: requirements.slice(0, Math.min(3, requirements.length)).map((item) => item.id),
      mitigation_note: dependencyExcerpt
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