import { redirect } from "next/navigation";

/** The site's public entry point is the events landing page — anyone can
 * browse and register without logging in. Login is only required for the
 * management dashboard (see /dashboard, /signin). */
export default function HomePage() {
  redirect("/events");
}
