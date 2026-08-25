/**
 * Demo Data Layer — بيانات سنتر النور التجريبي
 * نفس الinterface ده هيتحول لاستعلامات Supabase لما المفاتيح تتربط
 * (انظر docs/NOTES-REFERENCE.md — قرار معماري #2)
 *
 * TODO(Phase 1.2): استبدل كل دالة بـ supabase.from("...") — الsignatures ثابتة
 */

export type StudentStatus = "present" | "absent" | "late" | "pending";

export type Student = {
  id: string;
  name: string;
  groupId: string;
  parentPhone: string;
  status: StudentStatus;
};

export type Group = {
  id: string;
  name: string;
  grade: string;
  subject: string;
  monthlyFee: number;
  todaySlot: string;
};

export type Kpis = {
  presentToday: number;
  absentToday: number;
  collectedMonth: number;
  outstanding: number;
  lateStudents: number;
};

export type EarlyWarningStudent = {
  id: string;
  name: string;
  reason: string;
  detail: string;
};

export type FeedEvent = {
  id: string;
  kind: "attendance" | "payment" | "exam" | "message";
  title: string;
  detail: string;
  time: string;
};

export const DEMO_GROUPS: Group[] = [
  { id: "g1", name: "مجموعة السبت", grade: "٣ ثانوي", subject: "فيزياء", monthlyFee: 600, todaySlot: "4:00 م" },
  { id: "g2", name: "مجموعة الأحد", grade: "٢ ثانوي", subject: "فيزياء", monthlyFee: 600, todaySlot: "6:00 م" },
  { id: "g3", name: "مجموعة الثلاثاء", grade: "٣ إعدادي", subject: "علوم", monthlyFee: 450, todaySlot: "8:00 م" },
];

export const DEMO_STUDENTS: Student[] = [
  { id: "s01", name: "يوسف صبري", groupId: "g1", parentPhone: "+201200000011", status: "present" },
  { id: "s02", name: "منة الله طارق", groupId: "g1", parentPhone: "+201200000012", status: "absent" },
  { id: "s03", name: "عبد الرحمن ماهر", groupId: "g1", parentPhone: "+201200000013", status: "present" },
  { id: "s04", name: "سلمى إبراهيم", groupId: "g1", parentPhone: "+201200000014", status: "present" },
  { id: "s05", name: "مريم عادل", groupId: "g1", parentPhone: "+201200000015", status: "present" },
  { id: "s06", name: "حبيبة مصطفى", groupId: "g2", parentPhone: "+201200000016", status: "pending" },
  { id: "s07", name: "عمر خالد", groupId: "g2", parentPhone: "+201200000017", status: "pending" },
  { id: "s08", name: "سما هشام", groupId: "g2", parentPhone: "+201200000018", status: "pending" },
  { id: "s09", name: "أحمد محمود", groupId: "g3", parentPhone: "+201200000019", status: "pending" },
  { id: "s10", name: "سارة علي", groupId: "g3", parentPhone: "+201200000020", status: "pending" },
];

export function getTenantInfo() {
  return { name: "سنتر النور", slug: "demo", plan: "trial", color: "#1A73E8" };
}

export function getGroups(): Group[] {
  return DEMO_GROUPS;
}

export function getStudentsByGroup(groupId?: string): Student[] {
  return groupId ? DEMO_STUDENTS.filter((s) => s.groupId === groupId) : DEMO_STUDENTS;
}

export function getKpis(): Kpis {
  const g1 = DEMO_STUDENTS.filter((s) => s.groupId === "g1");
  return {
    presentToday: g1.filter((s) => s.status === "present").length,
    absentToday: g1.filter((s) => s.status === "absent").length,
    collectedMonth: 12400,
    outstanding: 1800,
    lateStudents: 3,
  };
}

export function getEarlyWarning(): EarlyWarningStudent[] {
  return [
    { id: "s02", name: "منة الله طارق", reason: "غياب متكرر", detail: "غابت 3 من آخر 5 حصص" },
    { id: "s07", name: "عمر خالد", reason: "متأخرات", detail: "شهرين بدون سداد" },
    { id: "s09", name: "أحمد محمود", reason: "انخفاض درجات", detail: "آخر امتحان: 40% (كان 75%)" },
  ];
}

export function getFeed(): FeedEvent[] {
  return [
    { id: "e1", kind: "payment", title: "دفعة جديدة", detail: "أحمد محمود — 600 ج كاش · إيصال #1042", time: "قبل 10 دقايق" },
    { id: "e2", kind: "attendance", title: "التحضير خلص", detail: "مجموعة السبت: 38 حاضر · 2 غايب — الإشعارات اتبعتت", time: "قبل ساعة" },
    { id: "e3", kind: "exam", title: "نتيجة امتحان الفيزيا", detail: "186 سلّموا · التصحيح الآلي خلص في 7 دقايق", time: "امبارح" },
    { id: "e4", kind: "message", title: "رسالة من ولي أمر", detail: "والدة سارة علي: «الامتحان الجاي امتى؟»", time: "امبارح" },
  ];
}
