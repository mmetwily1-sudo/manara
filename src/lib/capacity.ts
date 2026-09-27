/** سعة المجموعة: true تعني ممتلئة (capacity>0 وعدد النشطين >= السعة) */
export async function isGroupFull(admin: any, tenantId: string, groupId: string): Promise<boolean> {
  try {
    const { data: g } = await admin.from("groups").select("capacity").eq("id", groupId).eq("tenant_id", tenantId).single();
    const cap = Number((g as any)?.capacity ?? 0);
    if (!cap || cap <= 0) return false;
    const { count } = await admin.from("enrollments").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("group_id", groupId).eq("status", "active");
    return (count ?? 0) >= cap;
  } catch { return false; }
}
