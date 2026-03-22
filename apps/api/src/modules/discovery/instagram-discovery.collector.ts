import { Injectable } from "@nestjs/common";
import { CampaignSourceDto } from "../campaigns/campaigns.types";
import {
  DiscoveryCollectorCandidate,
  DiscoverySourceResultDto
} from "./discovery.types";

type CollectorOptions = {
  maxCandidatesPerSource: number;
  maxPostsPerLead: number;
  dryRun: boolean;
};

type CollectorResult = {
  candidates: DiscoveryCollectorCandidate[];
  sourceResult: DiscoverySourceResultDto;
  warnings: string[];
};

type InstagramBusinessDiscoveryRecord = {
  username?: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  media_count?: number;
  website?: string;
  media?: {
    data?: Array<{
      permalink?: string;
      caption?: string;
      timestamp?: string;
    }>;
  };
};

type InstagramHashtagSearchResponse = {
  data?: Array<{
    id?: string;
  }>;
};

type InstagramRecentMediaResponse = {
  data?: Array<{
    id?: string;
    caption?: string;
    permalink?: string;
    timestamp?: string;
    username?: string;
  }>;
};

@Injectable()
export class InstagramDiscoveryCollector {
  private readonly graphApiBaseUrl =
    process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() || "https://graph.facebook.com";
  private readonly graphApiVersion = process.env.INSTAGRAM_API_VERSION?.trim() || "v22.0";

  async collect(
    source: CampaignSourceDto,
    options: CollectorOptions
  ): Promise<CollectorResult> {
    if (options.dryRun) {
      return this.collectDryRun(source, options);
    }

    switch (source.sourceType.trim().toUpperCase()) {
      case "HASHTAG":
        return this.collectFromHashtag(source, options);
      case "SEED_ACCOUNT":
        return this.collectFromSeedAccount(source, options);
      case "KEYWORD":
        return {
          candidates: [],
          warnings: [
            `Keyword source "${source.sourceValue}" needs manual CSV or operator enrichment in v1.`
          ],
          sourceResult: {
            sourceType: source.sourceType,
            sourceValue: source.sourceValue,
            status: "SKIPPED",
            candidateCount: 0,
            warning: "Keyword discovery is manual-only in v1."
          }
        };
      default:
        return {
          candidates: [],
          warnings: [`Unsupported source type: ${source.sourceType}`],
          sourceResult: {
            sourceType: source.sourceType,
            sourceValue: source.sourceValue,
            status: "SKIPPED",
            candidateCount: 0,
            warning: `Unsupported source type: ${source.sourceType}`
          }
        };
    }
  }

  private async collectFromHashtag(
    source: CampaignSourceDto,
    options: CollectorOptions
  ): Promise<CollectorResult> {
    const hashtag = this.normalizeHashtag(source.sourceValue);
    const warnings: string[] = [];
    const { accessToken, instagramUserId } = this.requireApiConfig();

    const hashtagSearch = await this.callGraphApi<InstagramHashtagSearchResponse>(
      "/ig_hashtag_search",
      {
        access_token: accessToken,
        user_id: instagramUserId,
        q: hashtag
      }
    );

    const hashtagId = hashtagSearch.data?.[0]?.id;

    if (!hashtagId) {
      return {
        candidates: [],
        warnings: [`No hashtag match found for #${hashtag}.`],
        sourceResult: {
          sourceType: source.sourceType,
          sourceValue: source.sourceValue,
          status: "SKIPPED",
          candidateCount: 0,
          warning: `No hashtag match found for #${hashtag}.`
        }
      };
    }

    const recentMedia = await this.callGraphApi<InstagramRecentMediaResponse>(
      `/${hashtagId}/recent_media`,
      {
        access_token: accessToken,
        user_id: instagramUserId,
        limit: String(Math.max(3, options.maxCandidatesPerSource * 2)),
        fields: "id,caption,permalink,timestamp,username"
      }
    );

    const candidates: DiscoveryCollectorCandidate[] = [];
    const handledUsernames = new Set<string>();

    for (const media of recentMedia.data ?? []) {
      const username = media.username?.trim();

      if (!username) {
        continue;
      }

      const normalizedUsername = username.toLowerCase();

      if (handledUsernames.has(normalizedUsername)) {
        continue;
      }

      handledUsernames.add(normalizedUsername);

      try {
        const businessDiscovery = await this.fetchBusinessDiscovery(
          username,
          options.maxPostsPerLead
        );
        candidates.push({
          externalSourceType: source.sourceType,
          externalId: `${hashtagId}:${username}`,
          handle: `@${businessDiscovery.username ?? username}`,
          payload: {
            hashtag,
            recentMedia: media,
            businessDiscovery
          }
        });
      } catch (error) {
        warnings.push(
          `Could not enrich @${username} from hashtag #${hashtag}: ${this.toErrorMessage(error)}`
        );
        candidates.push({
          externalSourceType: source.sourceType,
          externalId: `${hashtagId}:${username}`,
          handle: `@${username}`,
          payload: {
            hashtag,
            recentMedia: media
          }
        });
      }

      if (candidates.length >= options.maxCandidatesPerSource) {
        break;
      }
    }

    return {
      candidates,
      warnings,
      sourceResult: {
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        status: "SUCCEEDED",
        candidateCount: candidates.length,
        warning: warnings[0]
      }
    };
  }

  private async collectFromSeedAccount(
    source: CampaignSourceDto,
    options: CollectorOptions
  ): Promise<CollectorResult> {
    const username = this.normalizeHandle(source.sourceValue);
    const businessDiscovery = await this.fetchBusinessDiscovery(
      username,
      options.maxPostsPerLead
    );

    return {
      candidates: [
        {
          externalSourceType: source.sourceType,
          externalId: username,
          handle: `@${businessDiscovery.username ?? username}`,
          payload: {
            businessDiscovery
          }
        }
      ],
      warnings: [],
      sourceResult: {
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        status: "SUCCEEDED",
        candidateCount: 1
      }
    };
  }

  private collectDryRun(
    source: CampaignSourceDto,
    options: CollectorOptions
  ): CollectorResult {
    const baseSlug = this.toSlug(source.sourceValue);
    const category = source.notes?.trim() || undefined;
    const candidates = Array.from(
      { length: Math.max(1, Math.min(options.maxCandidatesPerSource, 3)) },
      (_, index) => {
        const handle = `@${baseSlug}_${index + 1}`;
        return {
          externalSourceType: source.sourceType,
          externalId: `${source.sourceType}:${handle}`,
          handle,
          payload: {
            dryRun: true,
            username: handle.slice(1),
            name: `${this.toTitleCase(baseSlug)} Sample ${index + 1}`,
            biography: `${source.sourceType} dry-run candidate for ${source.sourceValue}.`,
            followers_count: 3500 + index * 1200,
            media_count: 24 + index * 7,
            media: {
              data: Array.from({ length: Math.min(options.maxPostsPerLead, 3) }, (_, postIndex) => ({
                permalink: `https://instagram.com/p/${baseSlug}${index + 1}${postIndex + 1}`,
                caption: `${source.sourceValue} sample post ${postIndex + 1}`,
                timestamp: new Date(
                  Date.now() - (index * 3 + postIndex) * 86_400_000
                ).toISOString()
              }))
            },
            website: `https://www.${baseSlug}${index + 1}.example.com`,
            category
          }
        };
      }
    );

    return {
      candidates,
      warnings: ["Dry run mode uses mock Instagram candidates and does not call Meta APIs."],
      sourceResult: {
        sourceType: source.sourceType,
        sourceValue: source.sourceValue,
        status: "SUCCEEDED",
        candidateCount: candidates.length,
        warning: "Dry run mode uses mock candidates."
      }
    };
  }

  private async fetchBusinessDiscovery(username: string, maxPostsPerLead: number) {
    const { accessToken, instagramUserId } = this.requireApiConfig();
    const targetUsername = this.normalizeHandle(username);
    const fields = [
      `business_discovery.username(${targetUsername}){`,
      "username,",
      "name,",
      "biography,",
      "followers_count,",
      "media_count,",
      "website,",
      `media.limit(${Math.max(1, maxPostsPerLead)}){caption,permalink,timestamp}`,
      "}"
    ].join("");

    const response = await this.callGraphApi<{
      business_discovery?: InstagramBusinessDiscoveryRecord;
    }>(`/${instagramUserId}`, {
      access_token: accessToken,
      fields
    });

    if (!response.business_discovery) {
      throw new Error(`No business discovery data returned for @${targetUsername}.`);
    }

    return response.business_discovery;
  }

  private requireApiConfig() {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
    const instagramUserId = process.env.INSTAGRAM_USER_ID?.trim();

    if (!accessToken || !instagramUserId) {
      throw new Error(
        "Instagram discovery requires INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID."
      );
    }

    return {
      accessToken,
      instagramUserId
    };
  }

  private async callGraphApi<T>(
    path: string,
    params: Record<string, string>
  ): Promise<T> {
    const url = new URL(
      `${this.graphApiVersion}${path}`,
      `${this.graphApiBaseUrl.replace(/\/$/, "")}/`
    );

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: {
            message?: string;
            type?: string;
            code?: number;
          };
        }
      | null;

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        `Instagram Graph API request failed with ${response.status}.`;
      throw new Error(message);
    }

    return payload as T;
  }

  private normalizeHashtag(value: string) {
    return value.trim().replace(/^#+/, "").toLowerCase();
  }

  private normalizeHandle(value: string) {
    return value.trim().replace(/^@+/, "").toLowerCase();
  }

  private toSlug(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/^[@#]+/, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized || "instagram_candidate";
  }

  private toTitleCase(value: string) {
    return value
      .split("_")
      .filter(Boolean)
      .map((item) => item[0]?.toUpperCase() + item.slice(1))
      .join(" ");
  }

  private toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
