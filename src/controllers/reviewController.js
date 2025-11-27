import { PrismaClient } from '@prisma/client';
import { uploadBufferToCloudinary } from '../lib/upload.js'; // your cloudinary helper
const prisma = new PrismaClient();

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
dayjs.extend(relativeTime);

export async function getToReview(req, res) {
  try {
    const userId = req.query.userId;
    const limit = parseInt(req.query.limit || '20');
    const offset = parseInt(req.query.offset || '0');

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // payments that are SUCCESS and not reviewed yet
    const payments = await prisma.payment.findMany({
      where: { userId, status: 'SUCCESS', isReviewed: false },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // fetch shops in batch
    const shopIds = [...new Set(payments.map(p => p.shopId).filter(Boolean))];
    const shops = await prisma.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, logoUrl: true }
    });
    const shopMap = Object.fromEntries(shops.map(s => [s.id, s]));

    // date formatting options (adjust locale/options as needed)
    const dateOptions = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    const items = payments.map(p => {
      const paidAtIso = p.createdAt ? p.createdAt.toISOString() : null;
      const paidAtReadable = p.createdAt
        ? new Date(p.createdAt).toLocaleString('en-IN', dateOptions) // e.g. "27 Nov 2025, 07:11 PM"
        : null;

      // Optional relative time (requires dayjs + relativeTime plugin)
      const paidAtRelative = p.createdAt ? dayjs(p.createdAt).fromNow() : null; // e.g. "2 hours ago"

      return {
        paymentId: p.id,
        paidAt: paidAtIso,
        paidAtReadable,
        paidAtRelative,      // keep or remove as you prefer
        shopId: p.shopId,
        shopName: shopMap[p.shopId]?.name || null,
        shopLogo: shopMap[p.shopId]?.logoUrl || null,
        menuId: p.menuId || null,
        menuName: p.menuName || null,
        amount: p.amount,
        rateNowAction: {
          paymentId: p.id,
          shopId: p.shopId,
          menuId: p.menuId || null,
        }
      };
    });

    const total = items.length;
    const paged = items.slice(offset, offset + limit);

    return res.json({ status: 'ok', total, limit, offset, items: paged });
  } catch (err) {
    console.error('getToReview error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}

// POST /reviews
// Body: { userId, shopId, paymentId?, rating, tags: [tagName], comment?, aiAuto?, anonymous? }
export async function createReview(req, res) {
  try {
    const { userId, shopId, paymentId, rating, tags = [], comment = null, anonymous = false } = req.body;
    if (!userId || !shopId || !rating) return res.status(400).json({ error: 'userId, shopId and rating required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1..5' });

    const created = await prisma.$transaction(async (tx) => {
      // create review
      const r = await tx.review.create({
        data: {
          userId,
          shopId,
          rating: Number(rating),
          comment,
          anonymous: !!anonymous,
          paymentId: paymentId || null
        }
      });

      // link/create tags
      for (const t of tags) {
        const tagName = (t || '').trim();
        if (!tagName) continue;
        let tag = await tx.reviewTag.findUnique({ where: { tagName } });
        if (!tag) {
          tag = await tx.reviewTag.create({ data: { tagName } });
        }
        // create link, ignore unique constraints errors by catching
        await tx.reviewTagLink.create({ data: { reviewId: r.id, tagId: tag.id } });
      }

      // if paymentId provided, mark payment as reviewed
      if (paymentId) {
        await tx.payment.update({ where: { id: paymentId }, data: { isReviewed: true } });
      }

      // update shop summary counts/rating if you want: (recompute aggregate)
      // simplest: increment reviewCount; optionally recompute avgRating
      await tx.shop.update({
        where: { id: shopId },
        data: { reviewCount: { increment: 1 } }
      });

      return r;
    });

    return res.status(201).json({
      status: 'ok',
      reviewId: created.id,
      message: 'Review created. Upload media with POST /reviews/:id/media or skip.'
    });

  } catch (err) {
    console.error('createReview error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}

// POST /reviews/:id/media (Multer middleware sets req.files)
export async function uploadReviewMedia(req, res) {
  try {
    const reviewId = req.params.id;
    if (!reviewId) return res.status(400).json({ error: 'reviewId required' });

    const review = await prisma.review.findUnique({ where: { id: reviewId }});
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const uploaded = [];
    const MAX_FILES = 6;
    if (files.length > MAX_FILES) return res.status(400).json({ error: `Max ${MAX_FILES} files allowed` });

    for (const f of files) {
      const kind = (f.mimetype || '').startsWith('video') ? 'video' : 'photo';
      const result = await uploadBufferToCloudinary(f.buffer, {
        resource_type: kind === 'video' ? 'video' : 'image',
        folder: `finwo/reviews/${reviewId}`
      });
      const media = await prisma.reviewMedia.create({
        data: {
          reviewId,
          url: result.secure_url,
          mimeType: f.mimetype,
          kind
        }
      });
      uploaded.push(media);
    }

    return res.json({ status: 'ok', uploaded });
  } catch (err) {
    console.error('uploadReviewMedia error', err);
    return res.status(500).json({ error: 'Failed to upload media', details: err.message });
  }
}

// GET /reviews?userId=&limit=&offset=  -> Reviewed tab
export async function getUserReviews(req, res) {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const limit = parseInt(req.query.limit || '20');
    const offset = parseInt(req.query.offset || '0');

    const [total, rows] = await Promise.all([
      prisma.review.count({ where: { userId } }),
      prisma.review.findMany({
        where: { userId },
        include: {
          tags: { include: { tag: true } },
          media: true,
          shop: { select: { id: true, name: true, logoUrl: true } },
          payment: true
        },
        orderBy: { createdAt: 'desc' }
        // skip: offset,
        // take: limit
      })
    ]);

    const reviews = rows.map(r => ({
      id: r.id,
      shopId: r.shopId,
      shopName: r.shop?.name,
      shopLogo: r.shop?.logoUrl,
      rating: r.rating,
      comment: r.comment,
      tags: (r.tags || []).map(tl => tl.tag.tagName),
      media: (r.media || []).map(m => ({ url: m.url, kind: m.kind })),
      createdAt: r.createdAt,
      payment: r.payment ? { id: r.payment.id, menuName: r.payment.menuName, amount: r.payment.amount } : null
    }));

    return res.json({ status: 'ok', total, limit, offset, reviews });
  } catch (err) {
    console.error('getUserReviews error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}

// GET /reviews/tags
export async function getReviewTags(req, res) {
  try {
    const tags = await prisma.reviewTag.findMany({ orderBy: { tagName: 'asc' } });
    return res.json({ status: 'ok', tags: tags.map(t => ({ id: t.id, tagName: t.tagName, description: t.description }))});
  } catch (err) {
    console.error('getReviewTags error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// GET /reviews/guidelines
export async function getReviewGuidelines(req, res) {
  try {
    const locale = String(req.query.locale || 'en');
    const activeQuery = req.query.active;
    const take = Math.min(Number(req.query.limit || 100), 500);

    const where = { locale };
    if (activeQuery === 'true') where.isActive = true;
    if (activeQuery === 'false') where.isActive = false;

    // If you want caching, add caching logic here (see note below)
    const rows = await prisma.reviewGuideline.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take
    });

    const guidelines = rows.map(r => ({
      id: r.id,
      key: r.key,
      text: r.text,
      locale: r.locale,
      isActive: r.isActive,
      sortOrder: r.sortOrder
    }));

    return res.json({ status: 'ok', total: guidelines.length, guidelines });
  } catch (err) {
    console.error('getReviewGuidelines error', err);
    // Fallback to static set if db unavailable
    const fallback = [
      "I confirm this review is based on my personal experience.",
      "Do not include personal data (phone numbers, emails).",
      "Avoid profanity. Reviews may be moderated by FINWO.",
      "By submitting you agree to FINWO's Guidelines."
    ];
    return res.json({ status: 'ok', total: fallback.length, guidelines: fallback.map((t, i) => ({ id: `fallback-${i}`, text: t })) });
  }
}

// src/controllers/reviewController.js
// Requires: Node 18+ (fetch), OPENAI_API_KEY in env
export async function getAiSuggestions(req, res) {
  try {
    const rating = Math.min(Math.max(Number(req.body.rating) || 5, 1), 5);
    const shortContext = String(req.body.shortContext || '').trim();
    const requestedCount = Number(req.body.count || 5);
    const requestedTemp = Number(req.body.temperature ?? 0.6);

    // Safety limits
    const MAX_COUNT = 50;              // don't allow enormous counts in one call
    const count = Math.min(Math.max(1, requestedCount), MAX_COUNT);
    const temperature = Math.min(Math.max(0.0, requestedTemp), 1.2);

    // Fallback template for when no API key
    const fallbackTemplates = {
      1: ["Very disappointed. Service/food was poor.", "Bad experience; not recommended.", "Service issues and poor quality."],
      2: ["Not satisfied; there were issues with quality/service.", "Below expectations; some problems.", "Disappointed with the experience."],
      3: ["It was okay; mixed experience.", "Average — some things were fine, others are not.", "Not bad, not great; an okay visit."],
      4: ["Good experience; would recommend.", "Pleasant visit — good food and service.", "Enjoyed it; likely to return."],
      5: ["Excellent! Loved it.", "Fantastic experience — highly recommended!", "Amazing food and service, would return."]
    };

    if (!process.env.OPENAI_API_KEY) {
      // If count > fallback size, generate extra by combining small variations
      const base = fallbackTemplates[rating] || fallbackTemplates[5];
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(base[i % base.length] + (i >= base.length ? ` (${i + 1})` : ''));
      }
      return res.json({ status: 'ok', suggestions: results, source: 'fallback' });
    }

    // System prompt to force JSON output
    const systemPrompt = `
You are a helpful assistant that generates short user-facing review suggestion sentences.
Respond ONLY with a JSON object EXACTLY in this form:
{"suggestions": ["...", "...", "..."]}
The "suggestions" array must have exactly N entries (replace N with the requested number).
Each suggestion must be 20-160 characters, clean from profanity, not contain personal data, and be independent lines.
No additional explanation or text outside the JSON object.
`;

    // build user prompt with variables
    const userPrompt = `
Generate ${count} suggestions for a rating of ${rating}.
Context: "${shortContext.replace(/"/g, '\\"')}".
Return EXACT JSON as: {"suggestions": ["...", "...", ...]}.
`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: Math.min(1024, 150 + count * 40) // rough token budget
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('OpenAI error', resp.status, txt);
      return res.status(502).json({ error: 'AI service unavailable', details: txt });
    }

    const payload = await resp.json();
    const assistant = payload?.choices?.[0]?.message?.content || '';

    // Defensive JSON extraction (strip triple backticks if any)
    const cleaned = assistant.replace(/(^```json|^```|```$)/g, '').trim();
    let suggestions = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions.map(s => String(s).replace(/\s+/g, ' ').trim()).slice(0, count);
      }
    } catch (e) {
      // If parsing fails, try simple line-splitting fallback
      suggestions = cleaned
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .slice(0, count);
    }

    // Safety & final normalization
    suggestions = suggestions.map(s => {
      let out = s.replace(/\s+/g, ' ').trim();
      if (out.length > 160) out = out.slice(0, 157) + '...';
      return out;
    }).filter(Boolean);

    // If still empty, return fallback
    if (suggestions.length === 0) {
      suggestions = (fallbackTemplates[rating] || fallbackTemplates[5]).slice(0, Math.min(count, 3));
      // pad to requested count
      while (suggestions.length < count) suggestions.push(`Thanks — your feedback matters.`);
    }

    return res.json({ status: 'ok', suggestions, source: 'openai' });
  } catch (err) {
    console.error('getAiSuggestions error', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}