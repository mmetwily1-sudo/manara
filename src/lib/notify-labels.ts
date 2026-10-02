/** عناوين عربية لأحداث الإشعارات — تُستخدم في صندوق البوابة/التقدم (يعمل بلا أي اشتراك) */
export const EVENT_LABELS: Record<string, { title: string; icon: string }> = {
  attendance_absent: { title: "تنبيه غياب", icon: "📋" },
  attendance_present: { title: "تسجيل حضور", icon: "✅" },
  exam_graded: { title: "نتيجة امتحان", icon: "📝" },
  exam_published: { title: "امتحان جديد", icon: "📝" },
  payment_received: { title: "استلام دفعة", icon: "💰" },
  payment_reminder: { title: "تذكير بالمصروفات", icon: "🔔" },
  homework_submitted: { title: "واجب جديد", icon: "📚" },
  homework_graded: { title: "تصحيح واجب", icon: "📚" },
  session_reminder: { title: "تذكير بحصة", icon: "⏰" },
  announcement: { title: "إعلان", icon: "📢" },
  certificate: { title: "شهادة جديدة", icon: "🎓" },
  points: { title: "نقاط", icon: "⭐" },
};

export function eventLabel(event: string): { title: string; icon: string } {
  return EVENT_LABELS[event] ?? { title: "تنبيه", icon: "🔔" };
}
