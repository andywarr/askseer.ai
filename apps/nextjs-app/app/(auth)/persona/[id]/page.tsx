// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { getPersona } from "@/apps/nextjs-app/lib/data";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const study = await getPersona(id, session.userId);

  console.info(study);

  return <div>Persona ID: {id}</div>;
}
