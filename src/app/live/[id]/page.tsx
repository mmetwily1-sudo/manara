import { redirect } from "next/navigation";
import { getSessionUser, adminClient } from "@/lib/server-auth";
import { LiveRoomClient } from "@/components/LiveRoomClient";

/** غرفة اللايف: Jitsi مضمنة أو رابط خارجي (زوم/غيره) + حضور + رفع يد */
export default async function LiveRoomPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const admin = adminClient();
  const { data: urow } = await admin.from("users").select("id,tenant_id,role,full_name")
    .eq("auth_user_id", user.id).single();
  if (!urow) redirect("/login");
  const tid = (urow as any).tenant_id;
  const isTeacher = (urow as any).role !== "student";
  const { data: s } = await admin.from("live_sessions")
    .select("id,title,group_id,starts_at,provider,ext_url,active")
    .eq("id", params.id).eq("tenant_id", tid).single();
  if (!s || !(s as any).active) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <div className="text-h1">🔴</div>
        <h1 className="mt-2 text-h1">الجلسة غير متاحة</h1>
        <p className="mt-1 text-small text-slate-500">ربما انتهت أو أُلغيت.</p>
      </main>
    );
  }
  if (!isTeacher && (s as any).group_id) {
    const { data: en } = await admin.from("enrollments").select("id")
      .eq("tenant_id", tid).eq("student_id", (urow as any).id)
      .eq("group_id", (s as any).group_id).eq("status", "active").limit(1).single();
    if (!en) redirect("/progress");
  }
  const room = "manara-" + String((s as any).id).replace(/-/g, "").slice(0, 20);
  return (
    <LiveRoomClient
      session={{
        id: (s as any).id,
        title: (s as any).title,
        provider: (s as any).provider ?? "jitsi",
        ext_url: (s as any).ext_url ?? "",
        room,
        starts_at: (s as any).starts_at,
      }}
      isTeacher={isTeacher}
    />
  );
}
