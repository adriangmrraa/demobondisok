import { redirect } from "next/navigation";

/** Redirect the root URL to the application's actual home screen. */
export default function RootPage() {
  redirect("/inicio");
}
