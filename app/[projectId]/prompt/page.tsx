"use server";

import { redirect } from "next/navigation";

interface PromptRedirectProps {
  params: Promise<{
    projectId?: string;
  }>;
}

const PromptRedirectPage = async ({ params }: PromptRedirectProps) => {
  const { projectId } = await params;

  if (!projectId) {
    console.error(
      "[PromptRedirect] Missing projectId, sending to /home instead of crashing.",
    );
    redirect("/home");
  }

  console.log("[PromptRedirect] Redirecting legacy prompt route", {
    projectId,
    target: `/${projectId}/scene-planner`,
  });
  redirect(`/${projectId}/scene-planner`);
};

export default PromptRedirectPage;
