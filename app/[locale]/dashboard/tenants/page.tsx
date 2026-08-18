import { redirect } from "next/navigation";

/** Tenants live as a tab on rent collection. Old links land there. */
export default async function TenantsIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/rent`);
}
