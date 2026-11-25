import type { CharacterDef, CharacterId } from "../engine/types";

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  jordan: {
    id: "jordan",
    name: "Jordan",
    role: "Platform Engineer",
    maxBudget: 72,
    starterDeck: ["serve", "serve", "serve", "serve", "serve", "provision", "provision", "provision", "provision", "inspect"],
    starterRelic: "monitoring",
    blurb: "Scales out with app servers, load balancers and autoscaling.",
  },
  taylor: {
    id: "taylor",
    name: "Taylor",
    role: "Site Reliability Engineer",
    maxBudget: 70,
    starterDeck: ["serve", "serve", "serve", "serve", "serve", "provision", "provision", "provision", "provision", "triage"],
    starterRelic: "postmortemCulture",
    blurb: "Survives failures with health checks, failover and fast recovery.",
  },
};
