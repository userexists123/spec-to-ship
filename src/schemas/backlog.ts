export interface SourceReference {
  section: string;
  excerpt: string;
}

export interface Requirement {
  id: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  source_refs: SourceReference[];
}

export interface Epic {
  id: string;
  title: string;
  summary: string;
  requirement_ids: string[];
  source_refs: SourceReference[];
}

export interface AcceptanceCriterion {
  id: string;
  story_id: string;
  text: string;
}

export interface Story {
  id: string;
  epic_id: string;
  title: string;
  summary: string;
  requirement_ids: string[];
  acceptance_criteria: AcceptanceCriterion[];
  source_refs: SourceReference[];
}

export interface Risk {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  related_requirement_ids: string[];
  mitigation_note: string;
}

export interface BacklogBundle {
  prd_id: string;
  title: string;
  requirements: Requirement[];
  epics: Epic[];
  stories: Story[];
  risks: Risk[];
}