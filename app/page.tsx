import type { Metadata } from "next";
import Workspace from "@/components/Workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "The Yanzx AI workspace: explorer, live canvas and assistant in one tri-pane IDE.",
};

export default function Page() {
  return <Workspace />;
}
