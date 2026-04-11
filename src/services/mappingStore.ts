import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getAppConfig } from "./config";

export interface BacklogMappingRecord {
  run_id: string;
  local_id: string;
  work_item_type: string;
  ado_work_item_id: number;
  ado_url: string;
  parent_local_id?: string;
  requirement_ids?: string[];
}

async function readExistingMappings(filePath: string): Promise<BacklogMappingRecord[]> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as BacklogMappingRecord[];
    }

    return [];
  } catch {
    return [];
  }
}

export async function appendBacklogMappings(records: BacklogMappingRecord[]): Promise<string> {
  const config = getAppConfig();
  const filePath = config.backlogMappingPath;
  const existing = await readExistingMappings(filePath);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify([...existing, ...records], null, 2), "utf8");

  return filePath;
}