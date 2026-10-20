import { cookies } from "next/headers";
import {
  PANEL_COOKIE,
  verifyPanelSessionToken,
} from "@/lib/auth/panel-edge";

export {
  PANEL_COOKIE,
  createPanelSessionToken,
  isPanelPasswordConfigured,
  panelCookieMaxAge,
  panelCookieOptions,
  verifyPanelPassword,
  verifyPanelSessionToken,
} from "@/lib/auth/panel-edge";

export async function isPanelAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifyPanelSessionToken(jar.get(PANEL_COOKIE)?.value);
}
