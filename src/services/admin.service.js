import config from "../config/index.js";
import { setEnvDataSync } from "../utils/env.util.js";
import { hashPasswordSync, comparePassword } from "../utils/password.util.js";
import * as db from "./db.service.js";

export const createAdminUser = async (username, password) => {
  const adminUser = {
    APP_USERNAME: username,
    APP_PASSWORD: hashPasswordSync(password),
  };
  setEnvDataSync(config.APP_DIR, adminUser);
  await createUser(username, password, "frontend,backend,mobile,user");
};

export const createUser = async (username, password, permissions) => {
  const user = {
    name: username,
    password: hashPasswordSync(password),
    permissions: permissions,
  };
  const isFoundSql = `SELECT * FROM users WHERE name = ?`;
  const isFound = await db.query(isFoundSql, [user.name]);
  if (isFound.length > 0) throw new Error("User already Exist");
  const insertSQL = `
      INSERT INTO users (name, password, permissions)
      VALUES (?, ?, ?)
    `;
  const result = await db.query(insertSQL, [
    user.name,
    user.password,
    user.permissions,
  ]);
};

export const validateUser = async (name, password) => {
  const isFoundSql = `SELECT * FROM users WHERE name = ?`;
  const isFound = await db.query(isFoundSql, [name]);
  if (isFound.length === 0) throw new Error("User not found");
  const isPasswordCorrect = await comparePassword(
    password,
    isFound[0].password
  );
  if (!isPasswordCorrect) {
    throw new Error("Password is incorrect");
  }
  return true;
};
