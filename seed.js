// prisma/seedReviewGuidelinesFull.js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const guidelines = [
  // Intro
  {
    key: 'intro',
    text:
      'We value authentic, constructive reviews that help others make informed decisions. To ensure your feedback is meaningful, respectful, and legally compliant, please follow these guidelines when submitting a review:',
    locale: 'en',
    sortOrder: 0,
  },

  // Heading: What to Include
  {
    key: 'what_to_include_title',
    text: 'What to Include in Your Review:',
    locale: 'en',
    sortOrder: 1,
  },

  // Bullets under What to Include
  {
    key: 'include_genuine_experience',
    text:
      'Your Genuine Experience: Share details about your personal experience with the product/service. Be specific—mention what you liked or didn’t like.',
    locale: 'en',
    sortOrder: 2,
  },
  {
    key: 'include_helpful_details_title',
    text: 'Helpful Details: Talk about things like:',
    locale: 'en',
    sortOrder: 3,
  },
  {
    key: 'include_helpful_details_quality',
    text: '• Quality of product/service',
    locale: 'en',
    sortOrder: 4,
  },
  {
    key: 'include_helpful_details_timeliness',
    text: '• Timeliness and responsiveness',
    locale: 'en',
    sortOrder: 5,
  },
  {
    key: 'include_helpful_details_support',
    text: '• Customer support experience',
    locale: 'en',
    sortOrder: 6,
  },
  {
    key: 'include_helpful_details_value',
    text: '• Value for money',
    locale: 'en',
    sortOrder: 7,
  },

  {
    key: 'include_constructive_feedback',
    text:
      "Constructive Feedback: It's okay to be critical, but please be respectful. Suggest ways the business could improve if applicable.",
    locale: 'en',
    sortOrder: 8,
  },

  // Heading: What to Avoid
  {
    key: 'what_to_avoid_title',
    text: 'What to Avoid:',
    locale: 'en',
    sortOrder: 9,
  },

  // Bullets under What to Avoid
  {
    key: 'avoid_false_misleading',
    text:
      "False or Misleading Information: Don't exaggerate or fabricate any part of your review.",
    locale: 'en',
    sortOrder: 10,
  },
  {
    key: 'avoid_personal_attacks',
    text: 'Personal Attacks: Avoid offensive language, threats, or personal insults.',
    locale: 'en',
    sortOrder: 11,
  },
  {
    key: 'avoid_private_information',
    text:
      'Private Information: Don’t share private details like phone numbers, addresses, email IDs, or order numbers.',
    locale: 'en',
    sortOrder: 12,
  },
  {
    key: 'avoid_promotional_content',
    text:
      'Promotional Content: Reviews should not include advertisements, links, or promotional content for other businesses.',
    locale: 'en',
    sortOrder: 13,
  },
  {
    key: 'avoid_conflict_of_interest',
    text:
      'Conflict of Interest: Do not write a review if you are an employee, owner, or have a personal interest in the business being reviewed.',
    locale: 'en',
    sortOrder: 14,
  },

  // Closing / Agreement
  {
    key: 'closing_agreement',
    text:
      'By submitting a review you confirm that your feedback is honest and in compliance with these guidelines. Reviews may be moderated and removed if they violate these rules.',
    locale: 'en',
    sortOrder: 15,
  }
];

async function main() {
  console.log('Seeding review guidelines...');
  const created = [];
  for (const g of guidelines) {
    const upserted = await prisma.reviewGuideline.upsert({
      where: { key: g.key },
      update: {
        text: g.text,
        locale: g.locale,
        isActive: true,
        sortOrder: g.sortOrder,
      },
      create: {
        key: g.key,
        text: g.text,
        locale: g.locale,
        isActive: true,
        sortOrder: g.sortOrder,
      }
    });
    created.push(upserted.key);
  }

  console.log('Seeded guidelines:', created);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });