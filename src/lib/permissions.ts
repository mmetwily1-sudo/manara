/**
 * مصفوفة صلاحيات الطاقم — المنع على السيرفر دائماً (توصية اللجنة).
 * teacher_admin: المالك (كل شيء) · supervisor: محتوى وتحضير بلا مالية ·
 * assistant: تحضير وطلاب · accountant: مالية وتحصيل.
 */
export const OWNER = "teacher_admin";
export const STAFF_ROLES = ["supervisor", "assistant", "accountant"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

// مجموعات جاهزة تُمرر لـ requireTeacher([...])
export const R = {
  owner: [OWNER],
  content: [OWNER, "supervisor"], // بنك/امتحانات/فيديو/واجبات/OMR/متجر/إعلانات
  attendance: [OWNER, "supervisor", "assistant"], // تحضير وجلسات وطلاب قراءة
  billingRead: [OWNER, "supervisor", "accountant"], // عرض مالي وتقارير
  billingWrite: [OWNER, "accountant"], // تحصيل ومراجعة وفواتير
  studentsRead: [OWNER, "supervisor", "assistant", "accountant"],
  studentsWrite: [OWNER], // إضافة/حذف طلاب للمالك فقط
  groupsRead: [OWNER, "supervisor", "assistant", "accountant"],
  groupsWrite: [OWNER],
  feedback: [OWNER, "supervisor", "assistant", "accountant"], // صوت الطاقم كله
};

/** نطاق الفرع لغير المالك: مجموعات فرعه + طلابها — المالك يرى الكل (null) */
export async function staffScope(
  admin: any, tenantId: string, role: string, userId: string
): Promise<{ groupIds: string[] | null; studentIds: string[] | null }> {
  if (role === OWNER) return { groupIds: null, studentIds: null };
  const { data: me } = await admin.from("users").select("branch_id").eq("id", userId).single();
  const branchId = (me as any)?.branch_id as string | null;
  if (!branchId) return { groupIds: null, studentIds: null }; // بلا فرع = كل السنتر
  const { data: gs } = await admin.from("groups").select("id").eq("tenant_id", tenantId).eq("branch_id", branchId);
  const groupIds = (gs ?? []).map((g: any) => g.id);
  let studentIds: string[] = [];
  if (groupIds.length) {
    const { data: enr } = await admin.from("enrollments").select("student_id").in("group_id", groupIds).limit(2000);
    studentIds = Array.from(new Set((enr ?? []).map((e: any) => e.student_id)));
  }
  return { groupIds, studentIds };
}
