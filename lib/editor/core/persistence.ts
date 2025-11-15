import { openDB } from "idb";
import type { Project } from "../types";

const DB_NAME = "capcut-editor";
const STORE_STATE = "project_state";
const STORE_HISTORY = "history";
const VERSION = 1;

export interface PersistedHistory {
  past: Project[];
  future: Project[];
}

export interface PersistedSnapshot {
  project: Project;
  history: PersistedHistory;
}

async function getDb() {
  return openDB(DB_NAME, VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_STATE)) {
        database.createObjectStore(STORE_STATE);
      }
      if (!database.objectStoreNames.contains(STORE_HISTORY)) {
        database.createObjectStore(STORE_HISTORY);
      }
    },
  });
}

export class ProjectPersistence {
  static async save(snapshot: PersistedSnapshot) {
    const db = await getDb();
    await db.put(STORE_STATE, snapshot.project, "active");
    await db.put(STORE_HISTORY, snapshot.history, "timeline");
  }

  static async load(): Promise<PersistedSnapshot | null> {
    const db = await getDb();
    const project = await db.get(STORE_STATE, "active");
    if (!project) {
      return null;
    }
    const history = (await db.get(STORE_HISTORY, "timeline")) as PersistedHistory | null;
    return { project, history: history ?? { past: [], future: [] } };
  }
}
