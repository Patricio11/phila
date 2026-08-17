import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const plans = await sql`select id, name, features from plans`;
console.log(JSON.stringify(plans, null, 1));
process.exit(0);
