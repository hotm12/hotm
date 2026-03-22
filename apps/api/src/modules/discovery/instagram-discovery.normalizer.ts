import { Injectable } from "@nestjs/common";
import { CampaignDetailDto } from "../campaigns/campaigns.types";
import {
  DiscoveryCollectorCandidate,
  DiscoveryNormalizedCandidateDto
} from "./discovery.types";

type CandidatePayload = {
  username?: unknown;
  name?: unknown;
  biography?: unknown;
  followers_count?: unknown;
  media_count?: unknown;
  website?: unknown;
  category?: unknown;
  businessDiscovery?: unknown;
  recentMedia?: unknown;
  media?: unknown;
};

@Injectable()
export class InstagramDiscoveryNormalizer {
  normalizeCandidate(
    campaign: CampaignDetailDto,
    candidate: DiscoveryCollectorCandidate,
    maxPostsPerLead: number
  ): DiscoveryNormalizedCandidateDto {
    const flattenedPayload = this.flattenPayload(candidate.payload);
    const username = this.readString(flattenedPayload, "username");
    const handle = candidate.handle?.trim() || (username ? `@${username}` : undefined);
    const bio = this.readString(flattenedPayload, "biography");
    const posts = this.extractPosts(flattenedPayload, maxPostsPerLead);

    return {
      campaignId: campaign.id,
      platform: "INSTAGRAM",
      handle,
      displayName:
        this.readString(flattenedPayload, "name") ||
        handle?.replace(/^@/, "") ||
        campaign.name,
      category:
        this.readString(flattenedPayload, "category") ||
        campaign.category ||
        undefined,
      followerCount: this.readNumber(flattenedPayload, "followers_count"),
      postCount: this.readNumber(flattenedPayload, "media_count"),
      bio,
      contactValue:
        this.extractEmail(bio) ||
        this.extractEmail(this.readString(flattenedPayload, "website")) ||
        undefined,
      posts
    };
  }

  private flattenPayload(payload: Record<string, unknown>): CandidatePayload {
    const businessDiscovery = this.readObject(payload, "businessDiscovery");

    if (businessDiscovery) {
      return {
        ...payload,
        ...businessDiscovery
      };
    }

    return payload;
  }

  private extractPosts(
    payload: CandidatePayload,
    maxPostsPerLead: number
  ): DiscoveryNormalizedCandidateDto["posts"] {
    const posts = this.readArray(this.readObject(payload, "media"), "data")
      .concat(this.readObject(payload, "recentMedia") ? [payload.recentMedia] : [])
      .map((item) => (typeof item === "object" && item ? item : null))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .slice(0, Math.max(1, maxPostsPerLead))
      .map((post) => ({
        postUrl: this.readString(post, "permalink") || "",
        caption: this.readString(post, "caption") || undefined,
        postedAt: this.readString(post, "timestamp") || undefined
      }))
      .filter((post) => post.postUrl);

    return posts;
  }

  private extractEmail(value?: string) {
    if (!value) {
      return null;
    }

    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0]?.toLowerCase() ?? null;
  }

  private readObject(value: Record<string, unknown>, key: string) {
    const nextValue = Reflect.get(value, key);
    return nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)
      ? (nextValue as Record<string, unknown>)
      : null;
  }

  private readArray(value: Record<string, unknown> | null, key: string) {
    if (!value) {
      return [];
    }

    const nextValue = Reflect.get(value, key);
    return Array.isArray(nextValue) ? nextValue : [];
  }

  private readString(value: Record<string, unknown>, key: string) {
    const nextValue = Reflect.get(value, key);
    return typeof nextValue === "string" && nextValue.trim() ? nextValue.trim() : undefined;
  }

  private readNumber(value: Record<string, unknown>, key: string) {
    const nextValue = Reflect.get(value, key);
    return typeof nextValue === "number" && Number.isFinite(nextValue) ? nextValue : undefined;
  }
}
