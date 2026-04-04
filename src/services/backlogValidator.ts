import { BacklogBundle } from "../schemas/backlog";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateBacklogBundle(bundle: BacklogBundle): ValidationResult {
  const errors: string[] = [];
  const requirementIds = bundle.requirements.map((item) => item.id);
  const epicIds = bundle.epics.map((item) => item.id);
  const storyIds = bundle.stories.map((item) => item.id);

  if (!bundle.title.trim()) {
    errors.push("Bundle title cannot be empty.");
  }

  if (bundle.requirements.length === 0) {
    errors.push("At least one requirement is required.");
  }

  if (bundle.epics.length === 0) {
    errors.push("At least one epic is required.");
  }

  if (bundle.stories.length === 0) {
    errors.push("At least one story is required.");
  }

  if (hasDuplicates(requirementIds)) {
    errors.push("Requirement IDs must be unique.");
  }

  if (hasDuplicates(epicIds)) {
    errors.push("Epic IDs must be unique.");
  }

  if (hasDuplicates(storyIds)) {
    errors.push("Story IDs must be unique.");
  }

  for (const requirement of bundle.requirements) {
    if (!requirement.title.trim()) {
      errors.push(`Requirement ${requirement.id} title cannot be empty.`);
    }

    if (!requirement.summary.trim()) {
      errors.push(`Requirement ${requirement.id} summary cannot be empty.`);
    }
  }

  for (const epic of bundle.epics) {
    if (!epic.title.trim()) {
      errors.push(`Epic ${epic.id} title cannot be empty.`);
    }

    if (epic.requirement_ids.length === 0) {
      errors.push(`Epic ${epic.id} must map to at least one requirement.`);
    }

    for (const requirementId of epic.requirement_ids) {
      if (!requirementIds.includes(requirementId)) {
        errors.push(`Epic ${epic.id} references unknown requirement ${requirementId}.`);
      }
    }
  }

  for (const story of bundle.stories) {
    if (!story.title.trim()) {
      errors.push(`Story ${story.id} title cannot be empty.`);
    }

    if (story.requirement_ids.length === 0) {
      errors.push(`Story ${story.id} must map to at least one requirement.`);
    }

    for (const requirementId of story.requirement_ids) {
      if (!requirementIds.includes(requirementId)) {
        errors.push(`Story ${story.id} references unknown requirement ${requirementId}.`);
      }
    }

    if (story.acceptance_criteria.length === 0) {
      errors.push(`Story ${story.id} must include at least one acceptance criterion.`);
    }

    for (const criterion of story.acceptance_criteria) {
      if (!criterion.text.trim()) {
        errors.push(`Acceptance criterion ${criterion.id} cannot be empty.`);
      }

      if (criterion.story_id !== story.id) {
        errors.push(`Acceptance criterion ${criterion.id} must reference ${story.id}.`);
      }
    }
  }

  for (const risk of bundle.risks) {
    if (!risk.title.trim()) {
      errors.push(`Risk ${risk.id} title cannot be empty.`);
    }

    for (const requirementId of risk.related_requirement_ids) {
      if (!requirementIds.includes(requirementId)) {
        errors.push(`Risk ${risk.id} references unknown requirement ${requirementId}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}