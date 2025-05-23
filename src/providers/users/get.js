import * as db from "../../services/db.service.js";
export async function listUsers() {
  return await db.query("SELECT * FROM users");
}

export async function findByIdAndDelete(userId) {
  const isFoundSql = `SELECT * FROM users WHERE id = ?`;
  const isFound = await db.query(isFoundSql, [userId]);
  if (isFound.length === 0) throw new Error("User not found");

  const deleteSQL = `
        DELETE FROM users WHERE id = ?`;
  await db.query(deleteSQL, [userId]);
}

export async function userPermissions(name) {
  const isFoundSql = `SELECT * FROM users WHERE name = ?`;
  const isFound = await db.query(isFoundSql, [name]);
  return isFound;
}
