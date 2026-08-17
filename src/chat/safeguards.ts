export type Handoff = {
  reason: "support" | "unconfirmed";
  url: "/contact/";
  email: "contact@aurorajewelstudio.com";
};

export type DirectChatResponse = {
  reply: string;
  handoff?: Handoff;
};

export type ChatCartItem = {
  variantId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  quantity: number;
};

const handoff = (reason: Handoff["reason"]): Handoff => ({
  reason,
  url: "/contact/",
  email: "contact@aurorajewelstudio.com",
});

export function hasBasketReference(message: string) {
  return /\b(?:cart|basket|bag)\b/i.test(message);
}

export function deterministicResponse(
  message: string,
  currency: string,
  cart: ChatCartItem[] = [],
): DirectChatResponse | null {
  const text = message.toLowerCase();
  const orderIssue =
    /\b(order|delivery|parcel|package|purchase|item)\b.*\b(lost|missing|late|damaged|broken|wrong|never arrived|not arrived|charged twice|dispute)\b|\b(lost|missing|late|damaged|broken|wrong|never arrived|not arrived|charged twice|dispute)\b.*\b(order|delivery|parcel|package|purchase|item)\b/i;

  if (/\b(human|person|agent|support team|someone real)\b/i.test(message) || orderIssue.test(message)) {
    return {
      reply:
        "I’m sorry you’re dealing with this. A human from Aurora should review it directly—please use our contact page or email contact@aurorajewelstudio.com with your order details, and I won’t guess at a resolution here.",
      handoff: handoff("support"),
    };
  }

  if (
    /\b(?:what(?:'s| is)|show|list|contents?|items?|anything|how many)\b.{0,40}\b(?:cart|basket|bag)\b|\b(?:cart|basket|bag)\b.{0,40}\b(?:contents?|items?|contain|inside|empty)\b/i.test(
      message,
    )
  ) {
    if (!cart.length) return { reply: "Your basket is currently empty." };
    const quantity = cart.reduce((total, item) => total + item.quantity, 0);
    const contents = cart
      .map(
        (item) =>
          `${item.quantity} × ${item.title}${item.variantTitle ? ` (${item.variantTitle})` : ""}`,
      )
      .join(", ");
    return {
      reply: `Your basket contains ${contents}. That’s ${quantity} ${quantity === 1 ? "item" : "items"} in total.`,
    };
  }

  if (/\b(nickel|hypoallergenic|allerg(?:y|ic|ies)|sensitive skin)\b/i.test(message)) {
    return {
      reply:
        "Aurora’s current product records do not confirm nickel content or hypoallergenic status, so I can’t safely make that claim. Please contact the studio with the exact piece you’re considering so the material can be confirmed before you order.",
      handoff: handoff("unconfirmed"),
    };
  }

  if (
    /\b(size|sizing|measure|measurement|fit|length)\b.*\b(ring|bracelet|necklace|earring|brooch|finger|wrist)\b|\b(ring|bracelet|necklace|earring|brooch|finger|wrist)\b.*\b(size|sizing|measure|measurement|fit|length)\b/i.test(
      message,
    )
  ) {
    if (/\bnecklace\b/i.test(message)) {
      return {
        reply:
          "Aurora’s current guide lists chokers at 14–16 inches, princess lengths at 17–19 inches, matinee lengths at 20–24 inches, and opera lengths at 28–36 inches. Measure a necklace whose placement you already like from end to end, and ask the studio to confirm the final made-to-order length.",
      };
    }
    if (/\bearring\b/i.test(message)) {
      return {
        reply:
          "Aurora’s current guide treats studs as having no drop, small drops as up to 1 inch, medium drops as 1–2 inches, and statement or chandelier styles as 2 inches or more. Drop is measured from where the earring meets the ear to its lowest point.",
      };
    }
    if (/\bbrooch\b/i.test(message)) {
      return {
        reply:
          "Aurora’s current guide lists small brooches up to 1.5 inches, medium brooches at 1.5–2.5 inches, and statement brooches at 2.5 inches or more, measured at the widest point. A delicate shawl usually suits a smaller piece, while a structured coat can support a larger one.",
      };
    }
    if (/\bbracelet|wrist\b/i.test(message)) {
      return {
        reply:
          "Measure your wrist where you wear a bracelet, then add about half an inch for comfortable movement. Aurora’s current guide runs from XS at 6 inches to XL at 8 inches, but the studio should confirm the final made-to-order size.",
      };
    }
    return {
      reply:
        "Wrap a strip of paper around the base of your finger, mark the overlap, and measure that circumference in millimetres; you can also measure the inner diameter of a ring that already fits. Aurora should confirm the final size before production.",
    };
  }

  if (/\b(return|returns|refund|refunds|exchange|exchanges)\b/i.test(message)) {
    return {
      reply:
        "Aurora’s current website accepts ready-made pieces returned within 7 days if they are unworn and in their original packaging; bespoke pieces are non-returnable. For an item that arrives damaged, contact Aurora within 48 hours with photos so the studio can arrange a replacement or refund.",
    };
  }

  if (/\b(shipping|ship internationally|international delivery|delivery time|delivery charge|shipping fee)\b/i.test(message)) {
    return {
      reply:
        "Shipping within Nepal is currently free; the website lists 1–3 business days inside Kathmandu Valley and 3–7 business days elsewhere in Nepal. International shipping is available by request, with the fee confirmed by quote, and bespoke production is listed as 7–14 business days.",
    };
  }

  if (/\b(convert|conversion|exchange rate|how much (?:is|would).+\b(?:usd|gbp|aud|cad|eur|npr|inr|jpy|cny|aed)\b)\b/i.test(text)) {
    return {
      reply: `I don’t calculate currency conversions in chat. Please select the currency you want on the site—the verified product cards I show will use the site’s current ${currency} pricing.`,
    };
  }

  if (/^(?:hi|hello|hey|namaste|good (?:morning|afternoon|evening))[!. ]*$/i.test(message.trim())) {
    return { reply: "Hello—I’m Aura. Are you looking for something for yourself, or choosing a gift?" };
  }
  if (/^(?:thanks|thank you|ty|great|perfect)[!. ]*$/i.test(message.trim())) {
    return { reply: "You’re very welcome. I’m here whenever you’d like help choosing a piece." };
  }

  return null;
}

export const unsupportedReply =
  "I don’t have enough confirmed Aurora information to answer that safely. I can help with another question, or connect you with the studio for a verified answer.";

export function compactModelReply(reply: string, maxWords = 28) {
  const normalized = reply.replace(/\s+/g, " ").trim();
  if (normalized.split(" ").length <= maxWords) return normalized;

  const sentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [normalized];
  const question = [...sentences].reverse().find((sentence) => sentence.includes("?"));
  const statement = sentences.find(
    (sentence) =>
      !sentence.includes("?") &&
      !/^\s*(?:congratulations|absolutely|certainly|of course|great choice)\b/i.test(sentence),
  );
  const candidate = [statement, question].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  if (candidate && candidate.split(" ").length <= maxWords) return candidate;
  if (question && question.trim().split(" ").length <= maxWords) return question.trim();
  return `${normalized.split(" ").slice(0, maxWords).join(" ").replace(/[,;:]$/, "")}…`;
}

export function guardModelReply(
  reply: string,
  options: {
    allowedPriceLabels?: string[];
    allergyEvidence?: boolean;
    policyEvidence?: boolean;
  } = {},
): string {
  if (!reply.trim() || reply.length > 1_000) return unsupportedReply;
  if (/https?:\/\/|www\./i.test(reply)) return unsupportedReply;
  if (
    !options.allergyEvidence &&
    /\b(nickel[- ]?free|hypoallergenic|safe for (?:allerg|sensitive skin))/i.test(reply)
  ) {
    return unsupportedReply;
  }
  if (
    !options.policyEvidence &&
    /\b(return|refund|exchange|shipping|delivery promise|warranty)\b/i.test(reply)
  ) {
    return unsupportedReply;
  }

  const prices = reply.match(/(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)\s?\d[\d,]*(?:\.\d{1,2})?/g) || [];
  const allowed = (options.allowedPriceLabels || []).map((value) => value.replace(/\s/g, ""));
  if (prices.some((price) => !allowed.some((value) => value.includes(price.replace(/\s/g, ""))))) {
    return unsupportedReply;
  }

  return reply;
}
