import { redirect } from "next/navigation";

// All groups is gone: Home replaces it (PRD F16.8). Old links land on Home.
export default function AllGroupsPage() {
  redirect("/home");
}
