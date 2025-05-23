import * as db from "../../services/db.service.js";
export async function listViews() {
  return await db.query("SELECT * FROM views");
}
