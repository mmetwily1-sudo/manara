import { headers } from "next/headers";

/** قراءة سياق الـ tenant داخل Server Components */
export type TenantContext = {
  isRoot: boolean;
  slug: string | null;
  host: string;
};

export function getTenantContext(): TenantContext {
  const h = headers();
  const slug = h.get("x-tenant-slug") || null;
  const host = h.get("x-tenant-host") || "";
  const isRoot = h.get("x-tenant-is-root") === "true";
  return { isRoot, slug, host };
}
