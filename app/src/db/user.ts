import { db } from "./index";
import { users } from "./schema";

/** Ownfit is single-user: the one row in `users`, created on first use. */
export async function currentUser() {
  const [existing] = await db.select().from(users).orderBy(users.createdAt).limit(1); // oldest wins if a race ever made two
  return existing ?? (await db.insert(users).values({}).returning())[0];
}
