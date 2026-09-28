/** هل الميزة مفعلة؟ (الغائب = مفعل — opt-out) */
export async function featureOn(admin: any, tenantId: string, key: string): Promise<boolean> {
  try {
    const { data } = await admin.from("tenant_features").select("enabled")
      .eq("tenant_id", tenantId).eq("key", key).single();
    if (!data) return true;
    return !!(data as any).enabled;
  } catch { return true; }
}
