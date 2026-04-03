import type { Metadata } from "next";
import { StephanyConsole } from "@/components/StephanyConsole";

export const metadata: Metadata = {
  title: "Stephany | ClawPort",
  description: "Live ElevenLabs Conversational AI agent inside ClawPort.",
};

export default function StephanyPage() {
  return <StephanyConsole />;
}
