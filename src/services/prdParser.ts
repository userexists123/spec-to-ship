import {
  AcceptanceCriterion,
  BacklogBundle,
  ConfidenceLevel,
  DraftAmbiguityWarning,
  Epic,
  EvidenceLabel,
  Requirement,
  Risk,
  SourceReference,
  Story,
  TrustMetadata
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

const VAGUE_WORDING_TERMS = [
  "easy",
  "simple",
  "fast",
  "slow",
  "better",
  "improve",
  "improved",
  "optimize",
  "optimized",
  "robust",
  "scalable",
  "secure",
  "user friendly",
  "intuitive",
  "nice",
  "clean",
  "seamless",
  "soon",
  "later",
  "eventually",
  "as needed",
  "etc",
  "and so on"
];

const OWNERSHIP_TERMS = [
  "owner",
  "owned by",
  "responsible",
  "responsibility",
  "pm",
  "engineering",
  "design",
  "qa",
  "support",
  "admin",
  "operator",
  "user",
  "customer"
];

const NON_FUNCTIONAL_TERMS = [
  "performance",
  "latency",
  "availability",
  "uptime",
  "security",
  "privacy",
  "audit",
  "scale",
  "scalability",
  "reliability",
  "timeout",
  "rate limit",
  "accessibility",
  "retention"
];

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

function containsAnyTerm(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();

  return terms.some((term) => lower.includes(term));
}

function createTrustMetadata(input: {
  evidenceLabel: EvidenceLabel;
  confidence: ConfidenceLevel;
  rationale: string;
  warnings?: string[];
}): TrustMetadata {
  return {
    evidence_label: input.evidenceLabel,
    confidence: input.confidence,
    rationale: input.rationale,
    warnings: input.warnings ?? []
  };
}

function getItemWarnings(text: string): string[] {
  const warnings: string[] = [];
  const lower = text.toLowerCase();

  if (containsAnyTerm(lower, VAGUE_WORDING_TERMS)) {
    warnings.push("Contains vague wording that may need PM clarification.");
  }

  if (!containsAnyTerm(lower, OWNERSHIP_TERMS)) {
    warnings.push("Ownership or actor is not clearly stated.");
  }

  if (
    lower.includes("improve") ||
    lower.includes("optimize") ||
    lower.includes("support") ||
    lower.includes("handle") ||
    lower.includes("manage")
  ) {
    const hasTestableSignal =
      lower.includes("when ") ||
      lower.includes("then ") ||
      lower.includes("must ") ||
      lower.includes("should ") ||
      lower.includes("within ") ||
      lower.includes("at least ") ||
      lower.includes("no more than ") ||
      /\d/.test(lower);

    if (!hasTestableSignal) {
      warnings.push("Outcome may not be directly testable without clearer acceptance criteria.");
    }
  }

  return warnings;
}

function confidenceFromWarnings(evidenceLabel: EvidenceLabel, warningCount: number): ConfidenceLevel {
  if (warningCount >= 2) {
    return "Low";
  }

  if (warningCount === 1) {
    return evidenceLabel === "explicit" ? "Medium" : "Low";
  }

  return evidenceLabel === "explicit" ? "High" : "Medium";
}

function buildRequirementTrust(section: string, text: string): TrustMetadata {
  const warnings = getItemWarnings(text);
  const evidenceLabel: EvidenceLabel = REQUIREMENT_SECTIONS.includes(section) ? "explicit" : "inferred";
  const confidence = confidenceFromWarnings(evidenceLabel, warnings.length);

  return createTrustMetadata({
    evidenceLabel,
    confidence,
    rationale:
      evidenceLabel === "explicit"
        ? `Generated from explicit PRD text in the ${section} section.`
        : `Inferred from related PRD context because no explicit requirement section entry was available.`,
    warnings
  });
}

function buildInferredTrust(input: {
  basis: string;
  sourceWarnings?: string[];
  forceLowConfidence?: boolean;
}): TrustMetadata {
  const warnings = input.sourceWarnings ?? [];
  const confidence = input.forceLowConfidence ? "Low" : confidenceFromWarnings("inferred", warnings.length);

  return createTrustMetadata({
    evidenceLabel: "inferred",
    confidence,
    rationale: input.basis,
    warnings
  });
}

function detectAmbiguityWarnings(sections: SectionMap, requirements: Requirement[]): DraftAmbiguityWarning[] {
  const warnings: DraftAmbiguityWarning[] = [];
  const allLines = Object.entries(sections).flatMap(([section, lines]) =>
    lines.map((line) => ({
      section,
      line: stripBulletPrefix(line)
    }))
  );

  const addWarning = (warning: Omit<DraftAmbiguityWarning, "id">): void => {
    warnings.push({
      id: `AMB-${String(warnings.length + 1).padStart(3, "0")}`,
      ...warning
    });
  };

  const vagueLine = allLines.find((item) => containsAnyTerm(item.line, VAGUE_WORDING_TERMS));
  if (vagueLine) {
    addWarning({
      category: "vague_wording",
      severity: "medium",
      message: "Some PRD wording is subjective or underspecified.",
      evidence: `${vagueLine.section}: ${vagueLine.line}`
    });
  }

  const mixedScopeLine = allLines.find((item) => {
    const lower = item.line.toLowerCase();

    return (
      (lower.includes("frontend") && lower.includes("backend")) ||
      (lower.includes("ui") && lower.includes("api") && lower.includes("database")) ||
      (lower.includes("admin") && lower.includes("customer") && lower.includes("operator"))
    );
  });

  if (mixedScopeLine) {
    addWarning({
      category: "mixed_scope",
      severity: "medium",
      message: "A PRD line appears to combine multiple implementation scopes.",
      evidence: `${mixedScopeLine.section}: ${mixedScopeLine.line}`
    });
  }

  const unclearOwnershipRequirement = requirements.find((requirement) => {
    const combined = `${requirement.title} ${requirement.summary}`;
    return !containsAnyTerm(combined, OWNERSHIP_TERMS);
  });

  if (unclearOwnershipRequirement) {
    addWarning({
      category: "unclear_ownership",
      severity: "low",
      message: "At least one generated requirement does not clearly state the actor or owner.",
      evidence: `${unclearOwnershipRequirement.id}: ${unclearOwnershipRequirement.title}`
    });
  }

  const nonTestableRequirement = requirements.find((requirement) => {
    const combined = `${requirement.title} ${requirement.summary}`.toLowerCase();

    if (
      !combined.includes("improve") &&
      !combined.includes("optimize") &&
      !combined.includes("support") &&
      !combined.includes("handle") &&
      !combined.includes("manage")
    ) {
      return false;
    }

    return (
      !combined.includes("when ") &&
      !combined.includes("then ") &&
      !combined.includes("must ") &&
      !combined.includes("should ") &&
      !combined.includes("within ") &&
      !combined.includes("at least ") &&
      !combined.includes("no more than ") &&
      !/\d/.test(combined)
    );
  });

  if (nonTestableRequirement) {
    addWarning({
      category: "non_testable_outcome",
      severity: "medium",
      message: "At least one generated item may not be testable without sharper acceptance criteria.",
      evidence: `${nonTestableRequirement.id}: ${nonTestableRequirement.title}`
    });
  }

  const nonFunctionalLines = getSection(sections, "Non-Functional Requirements");
  const hasNonFunctionalDetails =
    nonFunctionalLines.length > 0 ||
    allLines.some((item) => containsAnyTerm(item.line, NON_FUNCTIONAL_TERMS));

  if (!hasNonFunctionalDetails) {
    addWarning({
      category: "missing_non_functional_details",
      severity: "high",
      message: "The PRD does not appear to specify non-functional expectations.",
      evidence: "No clear performance, security, reliability, scale, accessibility, or operational detail found."
    });
  }

  return warnings;
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
      source_refs: sourceRefs.length > 0 ? sourceRefs : [{ section: item.section, excerpt: item.text }],
      trust: buildRequirementTrust(item.section, item.text)
    };
  });
}

function buildEpics(requirements: Requirement[]): Epic[] {
  return requirements.map((requirement, index) => ({
    id: `EPIC-${String(index + 1).padStart(3, "0")}`,
    title: requirement.title,
    summary: requirement.summary,
    requirement_ids: [requirement.id],
    source_refs: requirement.source_refs,
    trust: buildInferredTrust({
      basis: `Epic inferred from ${requirement.id} to group related delivery work for Azure DevOps.`,
      sourceWarnings: requirement.trust.warnings
    })
  }));
}

function buildAcceptanceCriteria(issueId: string, requirement: Requirement): AcceptanceCriterion[] {
  const index = issueId.split("-")[1];

  return [
    {
      id: `AC-${index}-001`,
      story_id: issueId,
      text: `${requirement.title} is represented in the generated backlog output.`,
      trust: buildInferredTrust({
        basis: `Acceptance criterion inferred from ${requirement.id} because the PRD did not provide item-level acceptance criteria for this issue.`,
        sourceWarnings: requirement.trust.warnings
      })
    },
    {
      id: `AC-${index}-002`,
      story_id: issueId,
      text: `${requirement.id} remains linked to its issue and source references across repeated runs.`,
      trust: buildInferredTrust({
        basis: `Traceability criterion inferred from ${requirement.id} to preserve requirement-to-issue linkage.`,
        sourceWarnings: []
      })
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
      source_refs: requirement.source_refs,
      trust: buildInferredTrust({
        basis: `Issue inferred from ${requirement.id} for implementation tracking under ${epics[index].id}.`,
        sourceWarnings: requirement.trust.warnings
      })
    };
  });
}

function buildRisks(sections: SectionMap, requirements: Requirement[]): Risk[] {
  const riskLines = getSection(sections, "Risks and Assumptions");
  const dependencyLines = getSection(sections, "Dependencies");
  const risks: Risk[] = [];

  for (const [index, riskLine] of riskLines.map(stripBulletPrefix).filter(Boolean).entries()) {
    const itemWarnings = getItemWarnings(riskLine);
    const confidence = confidenceFromWarnings("explicit", itemWarnings.length);

    risks.push({
      id: `RISK-${String(index + 1).padStart(3, "0")}`,
      title: titleCase(riskLine.replace(/\.$/, "")),
      severity: index === 0 ? "high" : "medium",
      related_requirement_ids: requirements.slice(0, Math.min(4, requirements.length)).map((item) => item.id),
      mitigation_note: riskLine,
      trust: createTrustMetadata({
        evidenceLabel: "explicit",
        confidence,
        rationale: "Risk generated from explicit PRD risk or assumption text.",
        warnings: itemWarnings
      })
    });
  }

  if (dependencyLines.length > 0) {
    const dependencyExcerpt = dependencyLines.find((line) => !line.endsWith(":")) || dependencyLines[0];
    const cleanedDependencyExcerpt = stripBulletPrefix(dependencyExcerpt);
    const itemWarnings = getItemWarnings(cleanedDependencyExcerpt);

    risks.push({
      id: `RISK-${String(risks.length + 1).padStart(3, "0")}`,
      title: "External Dependencies May Delay Delivery",
      severity: "medium",
      related_requirement_ids: requirements.slice(0, Math.min(3, requirements.length)).map((item) => item.id),
      mitigation_note: cleanedDependencyExcerpt,
      trust: createTrustMetadata({
        evidenceLabel: "inferred",
        confidence: confidenceFromWarnings("inferred", itemWarnings.length),
        rationale: "Risk inferred from explicit dependency information in the PRD.",
        warnings: itemWarnings
      })
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
  const ambiguityWarnings = detectAmbiguityWarnings(sections, requirements);

  return {
    prd_id: prdId,
    title: extractProjectTitle(sections),
    requirements,
    epics,
    stories,
    risks,
    ambiguity_warnings: ambiguityWarnings
  };
}