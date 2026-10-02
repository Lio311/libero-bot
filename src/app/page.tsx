import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/data";

export default async function Page() {
  // The comparison changes every night; always render from the database.
  await connection();
  const data = await getDashboardData();
  return <Dashboard data={data} />;
}
