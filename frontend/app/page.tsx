import { redirect } from "next/navigation";

// La raíz redirige al login
export default function RootPage() {
  redirect("/login");
}
