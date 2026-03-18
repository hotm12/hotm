import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const sharedSeedTasks = new Map<string, Promise<unknown>>();

export const defaultChecklistLabels = [
  "Looks like a real seller account",
  "Has a reachable public contact channel",
  "Needs follow-up review note"
] as const;

const campaignSeedInclude = Prisma.validator<Prisma.CampaignDefaultArgs>()({
  include: {
    reviewChecklistTemplates: {
      orderBy: {
        updatedAt: "desc"
      },
      include: {
        items: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    }
  }
});

export type SeedCampaignRecord = Prisma.CampaignGetPayload<typeof campaignSeedInclude>;

export function createDefaultCampaignSeed() {
  return {
    name: "K-Beauty Instagram Sellers",
    category: "K-Beauty",
    targetPlatform: "INSTAGRAM",
    outreachChannelPriority: "EMAIL",
    status: "ACTIVE",
    description: "Review seller-like beauty accounts and reach out by email first.",
    sources: [
      {
        sourceType: "HASHTAG",
        sourceValue: "#kbeautystore",
        notes: "Hashtag-based discovery"
      },
      {
        sourceType: "SEED_ACCOUNT",
        sourceValue: "@kbeauty_example",
        notes: "Similar account discovery"
      }
    ],
    filters: [
      {
        filterType: "FOLLOWER_COUNT",
        operator: ">=",
        filterValue: "3000"
      },
      {
        filterType: "EXCLUDE_CATEGORY",
        operator: "NOT_IN",
        filterValue: "supplements,pharma"
      }
    ],
    scoringRuleSet: {
      name: "Default K-Beauty Score",
      isActive: true,
      rules: [
        {
          ruleName: "Store link on profile",
          scoreDelta: 20,
          ruleType: "PROFILE",
          conditionSummary: "Profile has a store or product link."
        },
        {
          ruleName: "Public email available",
          scoreDelta: 15,
          ruleType: "CONTACT",
          conditionSummary: "A public email address is visible."
        },
        {
          ruleName: "Sensitive category penalty",
          scoreDelta: -30,
          ruleType: "RISK",
          conditionSummary: "Profile appears to promote a restricted category."
        }
      ]
    },
    reviewChecklistTemplate: {
      name: "Default Review Checklist",
      isActive: true,
      items: defaultChecklistLabels.map((label, index) => ({
        label,
        itemType: index === 2 ? "TEXT" : "BOOLEAN",
        isRequired: index !== 2,
        sortOrder: index
      }))
    }
  };
}

export function createDefaultLeadSeeds() {
  return [
    {
      id: 1,
      campaignId: 1,
      platform: "INSTAGRAM",
      handle: "@kbeauty_store_lab",
      displayName: "KBeauty Store Lab",
      category: "K-Beauty",
      followerCount: 12200,
      postCount: 168,
      leadStatus: "REVIEW_READY",
      crmStage: "CONTACTED",
      riskFlags: ["Needs restricted-category review"],
      bio: "Beauty-focused seller account with product reviews and store links.",
      reviewNotes: "Public email and product links are visible on profile.",
      reviewChecklistAnswers: [
        {
          id: 1,
          label: defaultChecklistLabels[0],
          passed: true,
          note: "Profile and posts look commercial."
        },
        {
          id: 2,
          label: defaultChecklistLabels[1],
          passed: true,
          note: "Public email is visible."
        },
        {
          id: 3,
          label: defaultChecklistLabels[2],
          passed: false,
          note: "One product line may need restricted-category review."
        }
      ],
      contacts: [
        {
          id: 1,
          contactType: "EMAIL",
          contactValue: "hello@kbeautylab.example",
          isPrimary: true
        },
        {
          id: 2,
          contactType: "INSTAGRAM_DM",
          contactValue: "@kbeauty_store_lab",
          isPrimary: false
        }
      ],
      posts: [
        {
          id: 1,
          postUrl: "https://instagram.com/p/sample1",
          caption: "New skincare bundle launch",
          postedAt: "2026-03-15T10:00:00Z"
        },
        {
          id: 2,
          postUrl: "https://instagram.com/p/sample2",
          caption: "Best-selling serum collection",
          postedAt: "2026-03-12T10:00:00Z"
        }
      ]
    },
    {
      id: 2,
      campaignId: 1,
      platform: "INSTAGRAM",
      handle: "@seoul_skin_archive",
      displayName: "Seoul Skin Archive",
      category: "K-Beauty",
      followerCount: 4100,
      postCount: 74,
      leadStatus: "NEW",
      crmStage: "CONTACTED",
      riskFlags: [],
      bio: "Curated K-beauty content with some shopping intent signals.",
      reviewNotes: "Need stronger proof of direct selling activity.",
      reviewChecklistAnswers: [
        {
          id: 4,
          label: defaultChecklistLabels[0],
          passed: null,
          note: ""
        },
        {
          id: 5,
          label: defaultChecklistLabels[1],
          passed: false,
          note: "No public email found yet."
        }
      ],
      contacts: [
        {
          id: 3,
          contactType: "INSTAGRAM_DM",
          contactValue: "@seoul_skin_archive",
          isPrimary: true
        }
      ],
      posts: [
        {
          id: 3,
          postUrl: "https://instagram.com/p/sample3",
          caption: "Ingredient comparison carousel",
          postedAt: "2026-03-16T08:30:00Z"
        }
      ]
    },
    {
      id: 3,
      campaignId: 1,
      platform: "TIKTOK",
      handle: "@kglow_finds",
      displayName: "KGlow Finds",
      category: "Beauty Accessories",
      followerCount: 28000,
      postCount: 220,
      leadStatus: "APPROVED",
      crmStage: "REPLIED",
      riskFlags: ["Email is preferred over DM for this account"],
      bio: "Accessory-focused beauty recommendation account with strong engagement.",
      reviewNotes: "Brand fit looks strong. Personalization angle is ready.",
      reviewChecklistAnswers: [
        {
          id: 6,
          label: defaultChecklistLabels[0],
          passed: true,
          note: "Commercial profile confirmed."
        },
        {
          id: 7,
          label: defaultChecklistLabels[1],
          passed: true,
          note: "Public email verified."
        }
      ],
      contacts: [
        {
          id: 4,
          contactType: "EMAIL",
          contactValue: "partnerships@kglowfinds.example",
          isPrimary: true
        }
      ],
      posts: [
        {
          id: 4,
          postUrl: "https://tiktok.com/@kglow_finds/video/sample4",
          caption: "Beauty tool recommendation list",
          postedAt: "2026-03-14T12:00:00Z"
        }
      ]
    }
  ];
}

export async function runSharedSeedTask<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const existingTask = sharedSeedTasks.get(key) as Promise<T> | undefined;

  if (existingTask) {
    return existingTask;
  }

  const nextTask = task().finally(() => {
    sharedSeedTasks.delete(key);
  });

  sharedSeedTasks.set(key, nextTask);
  return nextTask;
}

export async function ensurePrimaryCampaignSeed(
  prisma: PrismaService
): Promise<SeedCampaignRecord> {
  return runSharedSeedTask("dev-seed:primary-campaign", async () => {
    const defaultCampaign = createDefaultCampaignSeed();
    let campaign = await prisma.campaign.findFirst({
      ...campaignSeedInclude,
      orderBy: {
        id: "asc"
      }
    });

    if (!campaign) {
      campaign = await prisma.campaign.create({
        ...campaignSeedInclude,
        data: {
          name: defaultCampaign.name,
          category: defaultCampaign.category,
          targetPlatform: defaultCampaign.targetPlatform,
          outreachChannelPriority: defaultCampaign.outreachChannelPriority,
          status: defaultCampaign.status,
          description: defaultCampaign.description,
          sources: {
            create: defaultCampaign.sources
          },
          filters: {
            create: defaultCampaign.filters
          },
          scoringRuleSets: {
            create: {
              name: defaultCampaign.scoringRuleSet.name,
              isActive: defaultCampaign.scoringRuleSet.isActive,
              rules: {
                create: defaultCampaign.scoringRuleSet.rules.map((rule, index) => ({
                  ruleName: rule.ruleName,
                  scoreDelta: rule.scoreDelta,
                  ruleType: rule.ruleType,
                  conditionJson: {
                    summary: rule.conditionSummary
                  },
                  sortOrder: index
                }))
              }
            }
          },
          reviewChecklistTemplates: {
            create: {
              name: defaultCampaign.reviewChecklistTemplate.name,
              isActive: defaultCampaign.reviewChecklistTemplate.isActive,
              items: {
                create: defaultCampaign.reviewChecklistTemplate.items
              }
            }
          }
        }
      });
    }

    const template = campaign.reviewChecklistTemplates[0];

    if (!template) {
      await prisma.reviewChecklistTemplate.create({
        data: {
          campaignId: campaign.id,
          name: defaultCampaign.reviewChecklistTemplate.name,
          isActive: true,
          items: {
            create: defaultCampaign.reviewChecklistTemplate.items
          }
        }
      });
    } else {
      const existingLabels = new Set(template.items.map((item) => item.label));
      const missingItems = defaultCampaign.reviewChecklistTemplate.items.filter(
        (item) => !existingLabels.has(item.label)
      );

      if (missingItems.length > 0) {
        const nextSortOrder = template.items.length;

        await prisma.reviewChecklistItem.createMany({
          data: missingItems.map((item, index) => ({
            templateId: template.id,
            label: item.label,
            itemType: item.itemType,
            isRequired: item.isRequired,
            sortOrder: nextSortOrder + index
          }))
        });
      }
    }

    return prisma.campaign.findUniqueOrThrow({
      ...campaignSeedInclude,
      where: {
        id: campaign.id
      }
    });
  });
}
