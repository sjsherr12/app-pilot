"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBugFlags } from "@/lib/bugs";
import type { FormState } from "./form-state";

const MAX_DISPLAY_NAME = 60;

export async function saveProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/account");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  if (!displayName) {
    return { ok: false, message: "Display name is required" };
  }
  if (displayName.length > MAX_DISPLAY_NAME) {
    return {
      ok: false,
      message: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer`,
    };
  }

  // `user` is the live record in the tenant store, so assignments persist.
  user.marketingOptIn = marketingOptIn;
  // Seeded bug `profile_name_not_persisted`: the request succeeds and the UI
  // says "Saved", but only the marketing preference is stored.
  if (!getBugFlags().profile_name_not_persisted) {
    user.displayName = displayName;
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
}
