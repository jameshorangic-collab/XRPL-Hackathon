import type { Structure } from "./types";
export type Deal = {
  structure: Structure;
  commitments: string[];
  status: "funding" | "active" | "settled";
  acceptedAt: string;
};
export function acceptStructure(structure: Structure): Deal {
  return {
    structure: structuredClone(structure),
    commitments: [],
    status: "funding",
    acceptedAt: new Date().toISOString(),
  };
}
export function requiredCommitments(deal: Deal): string[] {
  return [
    deal.structure.senior.offerId,
    ...deal.structure.junior.map((a) => a.offerId),
    "originator",
  ];
}
export function commitCapital(deal: Deal, id: string): Deal {
  if (deal.status !== "funding")
    throw new Error("Deal is not accepting commitments");
  if (!requiredCommitments(deal).includes(id))
    throw new Error("Unknown allocation");
  if (deal.commitments.includes(id))
    throw new Error("Capital already committed");
  const commitments = [...deal.commitments, id];
  return {
    ...deal,
    commitments,
    status:
      commitments.length === requiredCommitments(deal).length
        ? "active"
        : "funding",
  };
}
