/**
 * Trust labels from provenance:
 *  verified   - fact stated verbatim on the venue's own site (we have the URL)
 *  likely     - evidence of private dining but the specific fact is inferred/partial
 *  unverified - no direct evidence; needs a call
 */
import type { Extraction } from "./extract";
import type { TrustLabel } from "./types";

export function roomTrust(room: Extraction["rooms"][number]): TrustLabel {
  if (room.explicitly_stated && room.source_url) return "verified";
  if (room.explicitly_stated || room.seated_capacity != null || room.standing_capacity != null)
    return "likely";
  return "unverified";
}

export function venueTrust(ex: Extraction): { trust: TrustLabel; reasons: string[] } {
  const reasons: string[] = [];
  const verifiedRooms = ex.rooms.filter((r) => roomTrust(r) === "verified");

  if (verifiedRooms.length > 0) {
    reasons.push(
      `${verifiedRooms.length} private space${verifiedRooms.length > 1 ? "s" : ""} with capacities stated on the venue's own website`
    );
    if (ex.private_dining_url) reasons.push("Dedicated private dining page found");
    return { trust: "verified", reasons };
  }
  if (ex.has_private_dining_evidence) {
    reasons.push("Venue's website mentions private dining / events");
    if (ex.rooms.length > 0) reasons.push("Spaces mentioned but capacities not clearly stated");
    else reasons.push("No specific room capacities published");
    return { trust: "likely", reasons };
  }
  reasons.push("No private dining evidence found online - worth a call to confirm");
  return { trust: "unverified", reasons };
}

export function priceTrust(ex: Extraction): TrustLabel {
  const p = ex.price;
  if (p.explicitly_stated && (p.min_spend_low != null || p.per_person_low != null || p.tier))
    return "verified";
  if (p.tier || p.notes) return "likely";
  return "unverified";
}

export function contactTrust(ex: Extraction, googlePhone: string | null): TrustLabel {
  if (ex.events_email) return "verified";
  if (ex.events_phone) return "likely";
  if (googlePhone) return "likely";
  return "unverified";
}
