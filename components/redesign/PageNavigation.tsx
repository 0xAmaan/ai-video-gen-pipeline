"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Layout, Film, Scissors } from "lucide-react";

interface PageNavigationProps {
  projectId?: string;
  shotId?: string | null;
}

const DEFAULT_PATH = "/project-redesign/home";

export const PageNavigation = ({ projectId, shotId }: PageNavigationProps) => {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Prompt Planner",
      icon: Sparkles,
      href: projectId
        ? `/project-redesign/${projectId}/scene-planner`
        : DEFAULT_PATH,
      match: "/scene-planner",
    },
    {
      name: "Scene Iterator",
      icon: Film,
      href: projectId
        ? `/project-redesign/${projectId}/scene-iterator${
            shotId ? `?shotId=${shotId}` : ""
          }`
        : DEFAULT_PATH,
      match: "/scene-iterator",
    },
    {
      name: "Storyboard",
      icon: Layout,
      href: projectId
        ? `/project-redesign/${projectId}/storyboard`
        : DEFAULT_PATH,
      match: "/storyboard",
    },
    {
      name: "Video Editor",
      icon: Scissors,
      href: "/project-redesign/home",
      match: "/project-redesign/home",
    },
  ];

  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg p-1">
      {navItems.map((item) => {
        const isActive = pathname?.includes(item.match);
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
              isActive
                ? "bg-white text-black"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#3a3a3a]",
            )}
          >
            <Icon className="w-4 h-4" />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
};
