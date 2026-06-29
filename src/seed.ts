/**
 * Aurora Jewel — Database Seed Script
 *
 * PURPOSE: Run this BEFORE building for Hostinger to populate the database
 *          with all your products, variants, and admin credentials.
 *
 * HOW TO USE:
 *   1. Make sure your Postgres DB is running (or .env points to Vercel Postgres)
 *   2. Run: npm run seed
 *   3. Then run: cd ../storefront && npm run build
 *
 * IMAGE CONVENTION:
 *   Images are stored in: storefront/public/images/products/[category]/[product]/
 *   - main.webp   → thumbnail
 *   - side1.webp  → gallery image 1
 *   - side2.webp  → gallery image 2
 *
 * ADMIN CREDENTIALS are loaded from .env (ADMIN_EMAIL, ADMIN_PASSWORD)
 * Default: admin@aurorajewelstudio.com / aurora123
 */

import { initDatabase, query } from "./db";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Build image paths from category + handle
// ─────────────────────────────────────────────────────────────────────────────

function img(category: string, handle: string, file: string) {
  return `/images/products/${category}/${handle}/${file}`;
}

function productImages(
  category: string,
  handle: string,
  sideCount: number = 2,
) {
  const images = [{ url: img(category, handle, "main.webp") }];
  for (let i = 1; i <= sideCount; i++) {
    images.push({ url: img(category, handle, `side${i}.webp`) });
  }
  return images;
}

// Alias — kept for backward compatibility, both now produce .webp
const productImagesWebp = productImages;

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT DATA
// ─────────────────────────────────────────────────────────────────────────────

interface ProductSeed {
  handle: string;
  title: string;
  description: string;
  category_handle: string;
  thumbnail: string;
  images: { url: string }[];
  weight: number;
  options: Array<{ title: string; values: string[] }>;
  variants: Array<{
    title: string;
    sku: string;
    options: Record<string, string>;
    prices: { usd: number };
  }>;
  features: Record<string, string>;
}

// Standard Material option used for most products
const MATERIAL_OPTION = {
  title: "Material",
  values: ["Silver", "Panchadhatu"],
};

function silverPanchadhatuVariants(sku: string, silverPrice: number) {
  return [
    {
      id: `${sku}-SLV`,
      title: "Silver",
      sku: `${sku}-SLV`,
      options: { Material: "Silver" },
      prices: { usd: silverPrice },
    },
    {
      id: `${sku}-PANCH`,
      title: "Panchadhatu",
      sku: `${sku}-PANCH`,
      options: { Material: "Panchadhatu" },
      prices: { usd: Math.round(silverPrice * 0.6 * 100) / 100 },
    },
  ];
}

const PRODUCTS: ProductSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  //  DROPS (Necklaces)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "victorian-reverie",
    title: "Victorian Reverie",
    description:
      "A radiant crystal sunburst pendant adorned with sparkling zirconia, cascading into a lush green onyx gemstone drop on a delicate silver chain.",
    category_handle: "drops",
    thumbnail: img("drops", "victorian-reverie", "main.webp"),
    images: productImages("drops", "victorian-reverie"),
    weight: 12.41,
    features: {
      Stone: "Green Onyx",
      "Stone Type": "Lab Grown Stone",
      "Secondary Stone": "Moissanite",
      "Secondary Type": "Lab Grown Stone",
      Color: "Green",
      "Chain Length": '17" (customizable)',
      "Silver Weight": "12.410 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VICT-REV", 162.81),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  NEXUS (Bracelets)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "blush-bloom",
    title: "Blush Bloom",
    description:
      "Floral-inspired bangle featuring vibrant pink tourmaline gemstones in mixed oval and marquise cuts, artfully arranged in a garden-inspired blooming flower design.",
    category_handle: "nexus",
    thumbnail: img("nexus", "blush-bloom", "main.webp"),
    images: productImages("nexus", "blush-bloom"),
    weight: 21.0,
    features: {
      Stone: "Pink Tourmaline | Rose Quartz",
      "Stone Type": "Lab Grown Stone",
      Color: "Blush Pink",
      "Bracelet Length": '7" (adjustable)',
      "Silver Weight": "21.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLSH-BLM", 194.2),
  },
  {
    handle: "delicate-balance",
    title: "Delicate Balance",
    description:
      "Lustrous cream pearls nestle between diamond-studded spirals in this gracefully twisted open bangle, merging classic elegance with a modern appeal.",
    category_handle: "nexus",
    thumbnail: img("nexus", "delicate-balance", "main.webp"),
    images: productImages("nexus", "delicate-balance"),
    weight: 12.68,
    features: {
      Stone: "Pearl | Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "White | Silver",
      "Bracelet Length": '7.5" (adjustable)',
      "Silver Weight": "12.680 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("DLCT-BAL", 105.09),
  },
  {
    handle: "timeless-tale",
    title: "Timeless Tale",
    description:
      "A mint green onyx square and luminous pearl harmonize on a delicately textured gold bracelet, creating a refined pairing of elegant and aesthetic.",
    category_handle: "nexus",
    thumbnail: img("nexus", "timeless-tale", "main.webp"),
    images: productImages("nexus", "timeless-tale"),
    weight: 9.38,
    features: {
      Stone: "Pearl | Green Onyx | Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "White | Green",
      "Bracelet Length": '7" (adjustable)',
      "Silver Weight": "9.380 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("TMLS-TLE", 69.56),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  ESSENCE (Rings)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "bold-harmony",
    title: "Bold Harmony",
    description:
      "A striking cocktail ring with geometric symmetry. Bold lines meet soft curves, set with a deep amethyst center stone.",
    category_handle: "essence",
    thumbnail: img("essence", "bold-harmony", "main.webp"),
    images: productImages("essence", "bold-harmony"),
    weight: 7.0,
    features: {
      Stone: "Green Spinel",
      "Stone Type": "Lab Grown Stone",
      Color: "Green",
      "Ring Size": "Adjustable",
      "Silver Weight": "7.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLD-HRM", 88.81),
  },
  {
    handle: "hex-touch",
    title: "Hex Touch",
    description:
      "A delicate gold-polished band crowned with a vivid hexagonal green cubic zirconia, where modern geometry meets timeless elegance.",
    category_handle: "essence",
    thumbnail: img("essence", "hex-touch", "main.webp"),
    images: productImages("essence", "hex-touch"),
    weight: 2.21,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Green",
      "Ring Size": "Adjustable",
      "Silver Weight": "2.210 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("HEX-TCH", 16.45),
  },
  {
    handle: "onyx-glide",
    title: "Onyx Glide",
    description:
      "Statement ring showcasing a graceful row of rich green onyx cabochons elegantly framed by brilliant cubic zirconia-studded bands in soft gold-plated tone creating flair & grace.",
    category_handle: "essence",
    thumbnail: img("essence", "onyx-glide", "main.webp"),
    images: productImages("essence", "onyx-glide"),
    weight: 2.0,
    features: {
      Stone: "Cubic Zirconia, Green Onyx",
      "Stone Type": "Emerald, Cubic Zirconia",
      Color: "Green",
      "Ring Size": "Adjustable",
      "Silver Weight": "2.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("ONX-GLD", 103.61),
  },
  {
    handle: "royal-violet",
    title: "Royal Violet",
    description:
      "Satement ring featuring a magnificent emerald-cut amethyst centerpiece in rich violet hues, dramatically flanked by brilliant aqua-blue topaz stones in a vintage three-stone design.",
    category_handle: "essence",
    thumbnail: img("essence", "royal-violet", "main.webp"),
    images: productImages("essence", "royal-violet"),
    weight: 9.5,
    features: {
      Stone: "Blue Topaz, Amethyst",
      "Stone Type": "Amethyst, Blue Topaz",
      Color: "Purple & Blue",
      "Ring Size": "Adjustable",
      "Silver Weight": "9.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RYL-VLT", 88.81),
  },
  {
    handle: "soft-serenity",
    title: "Soft Serenity",
    description:
      "Luminous zirconia in soft pastels meets sparkling pave accents, creating an ethereal collection that captures the delicate design for this ring.",
    category_handle: "essence",
    thumbnail: img("essence", "soft-serenity", "main.webp"),
    images: productImages("essence", "soft-serenity"),
    weight: 3.4,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "White",
      "Ring Size": "Adjustable",
      "Silver Weight": "3.400 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SFT-SRN", 29.6),
  },
  {
    handle: "trinity-crest",
    title: "Trinity Crest",
    description:
      "Contemporary ring showcasing a trillion cut royal red gemstone with exceptional clarity and depth, arranged in a classic yet modern sleek setting to make a statement piece.",
    category_handle: "essence",
    thumbnail: img("essence", "trinity-crest", "main.webp"),
    images: productImages("essence", "trinity-crest"),
    weight: 2.94,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Red",
      "Ring Size": "Adjustable",
      "Silver Weight": "2.943 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("TRNT-CRS", 29.6),
  },
  {
    handle: "verdant-dream",
    title: "Verdant Dream",
    description:
      "A luminous trillion-cut green gemstone sits in a gracefully split gold band, blending organic elegance with the captivating brilliance of tropical design.",
    category_handle: "essence",
    thumbnail: img("essence", "verdant-dream", "main.webp"),
    images: productImages("essence", "verdant-dream"),
    weight: 2.66,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Green",
      "Ring Size": "Adjustable",
      "Silver Weight": "2.666 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VRDN-DRM", 25.22),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  SPARKLES (Earrings)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "black-harmony",
    title: "Black Harmony",
    description:
      "Sleek rose gold threads elegantly through deep black spinel squares, creating a striking modern silhouette that balances bold sophistication with refined minimalism.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "black-harmony", "main.webp"),
    images: productImages("sparkles", "black-harmony"),
    weight: 3.034,
    features: {
      Stone: "Black Spinel",
      "Stone Type": "Lab Grown Stone",
      Color: "Black",
      "Earring Type": "Drop",
      "Silver Weight": "3.034 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLK-HRM", 35.52),
  },
  {
    handle: "blooming-charm",
    title: "Blooming Charm",
    description:
      "Curved stud earrings showcasing cascading flower motifs in gradient pink tourmaline reating an elegant botanical statement that follows the natural curve of the ear.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "blooming-charm", "main.webp"),
    images: productImages("sparkles", "blooming-charm"),
    weight: 4.7,
    features: {
      Stone: "Pink Tourmaline",
      "Stone Type": "Lab Grown Stone",
      Color: "Pink",
      "Earring Type": "Chandelier",
      "Silver Weight": "4.70 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLM-CRM", 88.81),
  },
  {
    handle: "blue-majesty",
    title: "Blue Majesty",
    description:
      "Regal cuts anchor a dazzling cluster of blue and white crystals, creating an exquisite masterpiece with an icy foundation & a deep oceanic touch.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "blue-majesty", "main.webp"),
    images: productImages("sparkles", "blue-majesty"),
    weight: 6.555,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Blue",
      "Earring Type": "Chandelier",
      "Silver Weight": "6.555 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLU-MJT", 61.4),
  },
  {
    handle: "chandelier-spark",
    title: "Chandelier Spark",
    description:
      "Cascading green cubic zirconia teardrops framed in a show-stopping chandelier effect with contemporary radiance for unforgettable elegance.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "chandelier-spark", "main.webp"),
    images: productImages("sparkles", "chandelier-spark"),
    weight: 12.5,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Green",
      "Earring Type": "Chandelier",
      "Silver Weight": "12.500 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CHND-SPK", 91.77),
  },
  {
    handle: "circle-celeste",
    title: "Circle Celeste",
    description:
      "A jeweled constellation orbits within polished gold hoops, blending sapphire, pink tourmaline, and emerald in a playfully sophisticated celestial dance.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "circle-celeste", "main.webp"),
    images: productImages("sparkles", "circle-celeste"),
    weight: 3.55,
    features: {
      Stone: "Kyanite, Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Blue, Pink",
      "Earring Type": "Hoop",
      "Silver Weight": "3.550 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CRC-CLT", 47.36),
  },
  {
    handle: "dazzle-drops",
    title: "Dazzle Drops",
    description:
      "Stunning handmade three-stone drop earrings featuring a captivating gradient of turquoise blue, soft rose pink, and rich emerald green onyx framed with sparkling crystal halos for an elegant, eye-catching design.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "dazzle-drops", "main.webp"),
    images: productImages("sparkles", "dazzle-drops"),
    weight: 16.0,
    features: {
      Stone: "Onyx",
      "Stone Type": "Lab Grown Stone",
      Color: "Green, Blue and Pink",
      "Earring Type": "Dangle",
      "Silver Weight": "16.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("DZL-DRP", 118.41),
  },
  {
    handle: "oceanic-ombre",
    title: "Oceanic Ombré",
    description:
      "Aqua cushion-cut topaz cascades through emerald pavé bands to luminous teardrops, creating a breathtaking gradient from sky to sea in one exquisite design.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "oceanic-ombré ", "main.webp"),
    images: productImages("sparkles", "oceanic-ombré "),
    weight: 4.75,
    features: {
      Stone: "Sky Blue Topaz, Green Amethyst",
      "Stone Type": "Lab Grown Stone",
      Color: "Blue, Green",
      "Earring Type": "Drop",
      "Silver Weight": "4.750  gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("OCN-OMB", 68.08),
  },
  {
    handle: "purple-symphony",
    title: "Purple Symphony",
    description:
      "Luminous amethyst teardrops crowned with rose gold squares to create a gracefully graduated silhouette, merging regal purple hues with contemporary sophistication.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "purple-symphony", "main.webp"),
    images: productImages("sparkles", "purple-symphony"),
    weight: 2.368,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Purple",
      "Earring Type": "Drop",
      "Silver Weight": "2.368 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("PRPL-SYM", 56.24),
  },
  {
    handle: "regal-magnifique",
    title: "Regal Magnifique",
    description:
      "Magnificent emerald-cut green crystals cascade through brilliant diamonds to royal blue teardrops, creating a breathtaking statement of jewel-toned opulence and timeless drama.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "regal-magnifique", "main.webp"),
    images: productImages("sparkles", "regal-magnifique"),
    weight: 4.547,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Green, Blue",
      "Earring Type": "Statement",
      "Silver Weight": "4.547 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RGL-MGN", 59.2),
  },
  {
    handle: "vintage-shine",
    title: "Vintage Shine",
    description:
      "Magnificent vintage-inspired earrings featuring a dramatic bow and ribbon design, adorned with vibrant ruby-red gemstones in an elegant Art Deco style.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "vintage-shine", "main.webp"),
    images: productImages("sparkles", "vintage-shine", 3),
    weight: 10.5,
    features: {
      Stone: "Ruby Onyx, Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Pink, White",
      "Earring Type": "Drop",
      "Silver Weight": "10.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VNT-SHN", 125.81),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  RADIANCE (Anklets)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "celest-charm",
    title: "Celest Charm",
    description:
      "Delicate evil eye protection locket & anklet set (can order seperately also) featuring a white mother-of-pearl eye centerpiece surrounded by sparkling crystals, accented with turquoise-blue beads on a fine silver setting.",
    category_handle: "radiance",
    thumbnail: img("radiance", "celest-charm", "main.webp"),
    images: productImages("radiance", "celest-charm"),
    weight: 4.4,
    features: {
      Stone: "Mother of Pearl",
      "Stone Type": "Lab Grown Stone",
      Color: "Blue, White",
      "Anklet Length": '11" (adjustable)',
      "Silver Weight": "4.400 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CLST-CRM", 118.41),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  EMBLEM (Brooch)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "feather-poise",
    title: "Feather Poise",
    description:
      "Feather-inspired brooch showcasing delicate curved lines adorned with brilliant crystals and crowned by a vivid blue centerpiece in a lustrous silver tone.",
    category_handle: "emblem",
    thumbnail: img("emblem", "feather-poise", "main.webp"),
    images: productImages("emblem", "feather-poise"),
    weight: 16.0,
    features: {
      Stone: "Crystal, Cubic Zirconia",
      "Stone Type": "Lab Grown Stone",
      Color: "Blue",
      "Pin Type": "Coat Lapel",
      "Silver Weight": "16.000 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("FTHR-POS", 118.41),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May I Collection (Drops)
  // ═══════════════════════════════════════════════════════════════════════════
  // May I collection
  {
    handle: "emerald-whisper",
    title: "Emerald Whisper",
    description:
      "A breathtaking pear-cut emerald suspended from a brilliant zirconia accent, set in luminous white rhodium silver chain",
    category_handle: "drops",
    thumbnail: img("drops", "emerald-whisper", "main.webp"),
    images: productImagesWebp("drops", "emerald-whisper"),
    weight: 4.51,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "5.0 CT",
      "Silver Weight": "4.51 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMR-WHP", 36.23),
  },
  // May I collection
  {
    handle: "arc-regal",
    title: "Arc Regal",
    description:
      "A sleek curved gold coated curve, flanked by two zirconia accents, suspends a vivid emerald-cut gemstone at the center",
    category_handle: "drops",
    thumbnail: img("drops", "arc-regal", "main.webp"),
    images: productImagesWebp("drops", "arc-regal"),
    weight: 4.9,
    features: {
      Stone: "Green Onyx, Moissannite",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "2.31 CT",
      "Silver Weight": "4.90 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("ARC-RGL", 62.58),
  },
  // May I collection
  {
    handle: "silver-spear",
    title: "Silver Spear",
    description:
      "A bold marquise-shaped pendant encrusted with pavé zirconia, edged with sharp silver points — where raw edge meets refined brilliance.",
    category_handle: "drops",
    thumbnail: img("drops", "silver-spear", "main.webp"),
    images: productImagesWebp("drops", "silver-spear"),
    weight: 1.12,
    features: {
      Stone: "Cubic Zirconia",
      "Stone Type": "ADD HERE",
      Color: "White",
      "Stone CT": "3.50 CT",
      "Silver Weight": "1.120 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SLV-SPR", 52.7),
  },
  // May I collection
  {
    handle: "ruby-slash",
    title: "Ruby Slash",
    description:
      "Three baguette rubies set in a sleek rose gold bar, framed by delicate diamond edges — understated boldness for the modern woman.",
    category_handle: "drops",
    thumbnail: img("drops", "ruby-slash", "main.webp"),
    images: productImagesWebp("drops", "ruby-slash"),
    weight: 4.58,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "1.60 CT",
      "Silver Weight": "4.58 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RBY-SLS", 39.52),
  },
  // May I collection
  {
    handle: "peridot-slash",
    title: "Peridot Slash",
    description:
      "One baguette peridot set in a sleek rose gold bar, framed by delicate diamond edges — understated boldness for the modern woman.",
    category_handle: "drops",
    thumbnail: img("drops", "peridot-slash", "main.webp"),
    images: productImagesWebp("drops", "peridot-slash"),
    weight: 3.82,
    features: {
      Stone: "Peridot",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "1.00 CT",
      "Silver Weight": "3.82 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("PDT-SLS", 26.35),
  },
  // May I collection
  {
    handle: "green-vault",
    title: "Green Vault",
    description:
      "A commanding emerald-cut stone set bold in silver — unapologetic, architectural, and strikingly powerful.",
    category_handle: "drops",
    thumbnail: img("drops", "green-vault", "main.webp"),
    images: productImagesWebp("drops", "green-vault"),
    weight: 3.84,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "6.00 CT",
      "Silver Weight": "3.84 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("GRN-VLT", 42.82),
  },
  // May I collection
  {
    handle: "blue-reign",
    title: "Blue Reign",
    description:
      "A rich oval sapphire radiating outward in a blaze of diamonds — the kind of piece that commands a room before you say a word.",
    category_handle: "drops",
    thumbnail: img("drops", "blue-reign", "main.webp"),
    images: productImagesWebp("drops", "blue-reign"),
    weight: 6.65,
    features: {
      Stone: "Blue Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "2.75 CT",
      "Silver Weight": "6.65 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLU-RGN", 62.58),
  },
  // May I collection
  {
    handle: "infinity-embrace",
    title: "Infinity Embrace",
    description:
      "A brilliant diamond cradled in a fluid silver twist — pure light, captured in motion.",
    category_handle: "drops",
    thumbnail: img("drops", "infinity-embrace", "main.webp"),
    images: productImagesWebp("drops", "infinity-embrace"),
    weight: 6.17,
    features: {
      Stone: "Moissanite",
      "Stone Type": "ADD HERE",
      Color: "White",
      "Stone CT": "1.55 CT",
      "Silver Weight": "6.17 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("INF-EMB", 69.17),
  },
  // May I collection
  {
    handle: "infinity-embrace-pendant",
    title: "Infinity Embrace Pendant",
    description:
      "A single round-cut moissanite cradled in a twisted infinity setting on a delicate silver chain — simple, timeless, and quietly stunning.",
    category_handle: "drops",
    thumbnail: img("drops", "infinity-embrace", "main.webp"),
    images: productImagesWebp("drops", "infinity-embrace"),
    weight: 5.86,
    features: {
      Stone: "Moissanite",
      "Stone Type": "ADD HERE",
      Color: "White",
      "Stone CT": "1.55 CT",
      "Silver Weight": "5.86 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("INF-EMB-PND", 69.17),
  },
  // May I collection
  {
    handle: "scattered-bloom",
    title: "Scattered Bloom",
    description:
      "A playful trail of multicolored gemstones drifting across silver — effortlessly whimsical, like wildflowers strung on light.",
    category_handle: "drops",
    thumbnail: img("drops", "scattered-bloom", "main.webp"),
    images: productImagesWebp("drops", "scattered-bloom"),
    weight: 10.5,
    features: {
      Stone: "Tourmaline",
      "Stone Type": "ADD HERE",
      Color: "Multi-color",
      "Stone CT": "20.00 CT",
      "Silver Weight": "10.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SCT-BLM", 102.1),
  },
  // May I collection
  {
    handle: "sapphire-whisper",
    title: "Sapphire Whisper",
    description:
      "A breathtaking pear-cut blue sapphire suspended from a brilliant zirconia accent, set in luminous white rhodium silver chain",
    category_handle: "drops",
    thumbnail: img("drops", "sapphire-whisper", "main.webp"),
    images: productImagesWebp("drops", "sapphire-whisper"),
    weight: 4.47,
    features: {
      Stone: "Blue Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "4.10 CT",
      "Silver Weight": "4.47 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SAP-WHP", 36.23),
  },
  // May I collection
  {
    handle: "velvet-ruby",
    title: "Velvet Ruby",
    description:
      "A pear-cut ruby wrapped in a full zirconia halo, suspended from a marquise floral cluster — dramatic, opulent, and red-carpet ready.",
    category_handle: "drops",
    thumbnail: img("drops", "velvet-ruby", "main.webp"),
    images: productImagesWebp("drops", "velvet-ruby"),
    weight: 9.06,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "9.90 CT",
      "Silver Weight": "9.06 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VLV-RBY", 82.34),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May I Collection (Nexus)
  // ═══════════════════════════════════════════════════════════════════════════
  // May I collection
  {
    handle: "emerald-embrace",
    title: "Emerald Embrace",
    description:
      "A lush oval emerald haloed in zirconia, with a braided silver bracelet — like luxury wrapped around your wrist.",
    category_handle: "nexus",
    thumbnail: img("nexus", "emerald-embrace", "main.webp"),
    images: productImagesWebp("nexus", "emerald-embrace"),
    weight: 12.67,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "6.0 CT",
      "Silver Weight": "12.67 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMR-EMB", 102.1),
  },
  // May I collection
  {
    handle: "crimson-tale",
    title: "Crimson Tale",
    description:
      "A bold square-cut ruby locked in gold on a sleek gold coated chain — structured desire, wrapped around your wrist.",
    category_handle: "nexus",
    thumbnail: img("nexus", "crimson-tale", "main.webp"),
    images: productImagesWebp("nexus", "crimson-tale"),
    weight: 10.41,
    features: {
      Stone: "Crystal",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "5.25 CT",
      "Silver Weight": "10.41 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CRM-TLE", 93.87),
  },
  // May I collection
  {
    handle: "timeless-cuff",
    title: "Timeless Cuff",
    description:
      "Minimalist gold open-bangle with a single bezel-set square green onyx stone wrapped in gold e-coating — clean, confident, and effortlessly chic.",
    category_handle: "nexus",
    thumbnail: img("nexus", "timeless-cuff", "main.webp"),
    images: productImagesWebp("nexus", "timeless-cuff"),
    weight: 10.41,
    features: {
      Stone: "Green Onyx",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "5.25 CT",
      "Silver Weight": "10.41 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("TML-CFF", 95.51),
  },
  // May I collection
  {
    handle: "sapphire-royale",
    title: "Sapphire Royale",
    description:
      "A stacked pair of silver bangles alternating oval sapphires and pavé zirconia — rich, regal, and made to be worn together.",
    category_handle: "nexus",
    thumbnail: img("nexus", "sapphire-royale", "main.webp"),
    images: productImagesWebp("nexus", "sapphire-royale"),
    weight: 24.13,
    features: {
      Stone: "Kyanite",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "17.00 CT",
      "Silver Weight": "24.13 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SAP-RYL", 263.49),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May I Collection (Sparkles)
  // ═══════════════════════════════════════════════════════════════════════════
  // May I collection
  {
    handle: "amber-drop",
    title: "Amber Drop",
    description:
      "Two emerald-cut citrines dripping from a zirconia, suspended from silver lever backs — warm, bold, and dangerously gorgeous.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "amber-drop", "main.webp"),
    images: productImagesWebp("sparkles", "amber-drop"),
    weight: 2.8,
    features: {
      Stone: "Citrine",
      "Stone Type": "ADD HERE",
      Color: "Yellow",
      "Stone CT": "3.95 CT",
      "Silver Weight": "2.80 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("AMB-DRP", 26.35),
  },
  // May I collection
  {
    handle: "chandelier-touch",
    title: "Chandelier Touch",
    description:
      "Gold-toned chandelier earrings with ruby red teardrop stones and zirconia accents in a cascading drop design – evergreen and sparkling",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "chandelier-touch", "main.webp"),
    images: productImagesWebp("sparkles", "chandelier-touch"),
    weight: 12.5,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "17.70 CT",
      "Silver Weight": "12.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CHD-TCH", 141.62),
  },
  // May I collection
  {
    handle: "solitaire-drops",
    title: "Solitaire Drops",
    description:
      "Gold coated hoops with pavé-set crystals and a dangling round-cut CZ stone for effortless everyday elegance.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "solitaire-drops", "main.webp"),
    images: productImagesWebp("sparkles", "solitaire-drops"),
    weight: 3.5,
    features: {
      Stone: "Zirconia",
      "Stone Type": "ADD HERE",
      Color: "White",
      "Stone CT": "1.50 CT",
      "Silver Weight": "3.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SLT-DRP", 29.64),
  },
  // May I collection
  {
    handle: "mosaic-blue",
    title: "Mosaic Blue",
    description:
      "Chandelier drop earrings layering London & Sky Blue Topaz cuts of teal stones in a silver pavé setting — perfect for making a statement.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "mosaic-blue", "main.webp"),
    images: productImagesWebp("sparkles", "mosaic-blue"),
    weight: 15.97,
    features: {
      Stone: "London Blue Topaz, Sky Blue Topaz",
      "Stone Type": "ADD HERE",
      Color: "Teal / Blue",
      "Stone CT": "11.90 CT",
      "Silver Weight": "15.97 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("MSC-BLU", 144.92),
  },
  // May I collection
  {
    handle: "verde-luxe",
    title: "Verde Luxe",
    description:
      "Rich oval emeralds wrapped in a full zirconia halo, with marquise and pear-cut stones cascading below — understated luxury at its finest.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "verde-luxe", "main.webp"),
    images: productImagesWebp("sparkles", "verde-luxe"),
    weight: 6.93,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "5.10 CT",
      "Silver Weight": "6.93 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VRD-LXE", 79.05),
  },
  // May I collection
  {
    handle: "midnight-cluster",
    title: "Midnight Cluster",
    description:
      "A bold emerald-cut navy sapphire crowned in gold plating, dropping into a trio of crystal teardrops for a polished, evening-ready finish.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "midnight-cluster", "main.webp"),
    images: productImagesWebp("sparkles", "midnight-cluster"),
    weight: 5.5,
    features: {
      Stone: "Blue Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Navy Blue",
      "Stone CT": "7.50 CT",
      "Silver Weight": "5.50 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("MID-CLS", 62.58),
  },
  // May I collection
  {
    handle: "olive-dangle",
    title: "Olive Dangle",
    description:
      "Delicate silver drop earrings with cushion and teardrop peridot stones linked by a trail of zirconia accents — effortlessly fresh and refined.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "olive-dangle", "main.webp"),
    images: productImagesWebp("sparkles", "olive-dangle"),
    weight: 6.02,
    features: {
      Stone: "Peridot",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "8.40 CT",
      "Silver Weight": "6.02 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("OLV-DNG", 71.14),
  },
  // May I collection
  {
    handle: "crystal-cluster",
    title: "Crystal Cluster",
    description:
      "Gold bezel-set emerald-cut crystals arranged in a geometric cluster, finished with round CZ accents — bold structure meets vintage glamour.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "crystal-cluster", "main.webp"),
    images: productImagesWebp("sparkles", "crystal-cluster"),
    weight: 9.0,
    features: {
      Stone: "Moissanite, Polki",
      "Stone Type": "ADD HERE",
      Color: "White",
      "Stone CT": "6.00 CT",
      "Silver Weight": "9.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CRY-CLS", 62.58),
  },
  // May I collection
  {
    handle: "emerald-dangle",
    title: "Emerald Dangle",
    description:
      "Delicate silver teardrop earrings with emerald stones connected by zirconia-cut links on a sleek silver drop — effortlessly elegant.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "emerald-dangle", "main.webp"),
    images: productImagesWebp("sparkles", "emerald-dangle"),
    weight: 6.01,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "9.55 CT",
      "Silver Weight": "6.01 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMR-DNG", 71.14),
  },
  // May I collection
  {
    handle: "sunset-stud",
    title: "Sunset Stud",
    description:
      "Trillion-cut citrine studs topped with a trio of zirconia accents — warm, radiant, and polished enough for any occasion.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "sunset-stud", "main.webp"),
    images: productImagesWebp("sparkles", "sunset-stud"),
    weight: 1.16,
    features: {
      Stone: "Citrine",
      "Stone Type": "ADD HERE",
      Color: "Yellow",
      "Stone CT": "1.25 CT",
      "Silver Weight": "1.16 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SUN-STD", 16.47),
  },
  // May I collection
  {
    handle: "luna-drops",
    title: "Luna Drops",
    description:
      "Sleek polished silver ball drops on a simple hook — minimal, modern, and endlessly wearable.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "luna-drops", "main.webp"),
    images: productImagesWebp("sparkles", "luna-drops"),
    weight: 3.25,
    features: {
      Stone: "ADD HERE",
      "Stone Type": "ADD HERE",
      Color: "Silver",
      "Stone CT": "ADD HERE",
      "Silver Weight": "3.25 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("LUN-DRP", 23.06),
  },
  // May I collection
  {
    handle: "medallion-rosette",
    title: "Medallion Rosette",
    description:
      "Blush pink teardrop studs blooming into an intricate pavé-set floral disc — feminine, statement-worthy, and undeniably elegant.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "medallion-rosette", "main.webp"),
    images: productImagesWebp("sparkles", "medallion-rosette"),
    weight: 11.53,
    features: {
      Stone: "Rose Quartz",
      "Stone Type": "ADD HERE",
      Color: "Pink",
      "Stone CT": "7.10 CT",
      "Silver Weight": "11.53 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("MDL-RST", 123.84),
  },
  // May I collection
  {
    handle: "emerald-stud",
    title: "Emerald Stud",
    description:
      "Trillion-cut emerald studs topped with a trio of zirconia accents — warm, radiant, and polished enough for any occasion.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "emerald-stud", "main.webp"),
    images: productImagesWebp("sparkles", "emerald-stud"),
    weight: 1.01,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "1.25 CT",
      "Silver Weight": "1.01 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMR-STD", 16.47),
  },
  // May I collection
  {
    handle: "medallion-sapphire",
    title: "Medallion Sapphire",
    description:
      "Blue sapphire teardrop studs blooming into an intricate pavé-set floral disc — feminine, statement-worthy, and undeniably elegant.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "medallion-sapphire", "main.webp"),
    images: productImagesWebp("sparkles", "medallion-sapphire"),
    weight: 10.73,
    features: {
      Stone: "Blue Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "5.30 CT",
      "Silver Weight": "10.73 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("MDL-SAP", 123.84),
  },
  // May I collection
  {
    handle: "medallion-emerald",
    title: "Medallion Emerald",
    description:
      "Emerald teardrop studs blooming into an intricate pavé-set floral disc — feminine, statement-worthy, and undeniably elegant.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "medallion-emerald", "main.webp"),
    images: productImagesWebp("sparkles", "medallion-emerald"),
    weight: 11.16,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "5.25 CT",
      "Silver Weight": "11.16 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("MDL-EMR", 123.84),
  },
  // May I collection
  {
    handle: "rose-drop",
    title: "Rose Drop",
    description:
      "Two emerald-cut rose quartz stones dripping from a zirconia, suspended from silver lever backs — warm, bold, and dangerously gorgeous.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "rose-drop", "main.webp"),
    images: productImagesWebp("sparkles", "rose-drop"),
    weight: 2.93,
    features: {
      Stone: "Rose Quartz",
      "Stone Type": "ADD HERE",
      Color: "Pink",
      "Stone CT": "5.05 CT",
      "Silver Weight": "2.93 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RSE-DRP", 29.64),
  },
  // May I collection
  {
    handle: "rose-dangle",
    title: "Rose Dangle",
    description:
      "Delicate silver teardrop earrings with rose quartz stones connected by zirconia-cut links on a sleek silver drop — effortlessly elegant.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "rose-dangle", "main.webp"),
    images: productImagesWebp("sparkles", "rose-dangle"),
    weight: 5.94,
    features: {
      Stone: "Rose Quartz",
      "Stone Type": "ADD HERE",
      Color: "Pink",
      "Stone CT": "8.90 CT",
      "Silver Weight": "5.94 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RSE-DNG", 71.14),
  },
  // May I collection
  {
    handle: "velvet-ruby-earrings",
    title: "Velvet Ruby Earrings",
    description:
      "A pear-cut ruby wrapped in a full zirconia halo, suspended from a marquise floral cluster — dramatic, opulent, and red-carpet ready.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "velvet-ruby", "main.webp"),
    images: productImagesWebp("sparkles", "velvet-ruby"),
    weight: 9.06,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "9.90 CT",
      "Silver Weight": "9.06 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VLV-RBY-ER", 82.34),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May II Collection (Drops)
  // ═══════════════════════════════════════════════════════════════════════════
  // May II collection
  {
    handle: "green-envy",
    title: "Green Envy",
    description:
      "A trail of round zirconia flows down a delicate silver chain, leading the eye to a bold emerald-cut green stone — simple, striking, and impossible to ignore.",
    category_handle: "drops",
    thumbnail: img("drops", "green-envy", "main.webp"),
    images: productImagesWebp("drops", "green-envy"),
    weight: 6.49,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "3.10 CT",
      "Silver Weight": "6.49 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("GRN-ENV", 62.58),
  },
  // May II collection
  {
    handle: "ruby-envy",
    title: "Ruby Envy",
    description:
      "A trail of round zirconia flows down a delicate silver chain, leading the eye to a bold emerald-cut ruby — simple, striking, and impossible to ignore.",
    category_handle: "drops",
    thumbnail: img("drops", "ruby-envy", "main.webp"),
    images: productImagesWebp("drops", "ruby-envy"),
    weight: 6.63,
    features: {
      Stone: "Ruby Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "4.50 CT",
      "Silver Weight": "6.63 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RBY-ENV", 62.58),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May II Collection (Essence)
  // ═══════════════════════════════════════════════════════════════════════════
  // May II collection
  {
    handle: "scarlet-garnet",
    title: "Scarlet Garnet",
    description:
      "A deep red oval garnet sits at the center of a glittering zirconia halo, set in warm gold with a beautifully tapered split-band.",
    category_handle: "essence",
    thumbnail: img("essence", "scarlet-garnet", "main.webp"),
    images: productImagesWebp("essence", "scarlet-garnet"),
    weight: 2.02,
    features: {
      Stone: "Garnet",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "1.20 CT",
      "Silver Weight": "2.02 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("SCL-GRN", 36.23),
  },
  // May II collection
  {
    handle: "verdant-trillion",
    title: "Verdant Trillion",
    description:
      "A vivid trillion-cut emerald sits at the heart of a bold double halo — sparkling zirconia ringed by deep green emeralds — all set in a striking silver-toned band.",
    category_handle: "essence",
    thumbnail: img("essence", "verdant-trillion", "main.webp"),
    images: productImagesWebp("essence", "verdant-trillion"),
    weight: 6.08,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "2.25 CT",
      "Silver Weight": "6.08 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VRD-TRL", 55.99),
  },
  // May II collection
  {
    handle: "golden-marquise",
    title: "Golden Marquise",
    description:
      "A sleek marquise-cut green onyx stone framed in gold beading pairs effortlessly with zirconia outline companion ring, made to be worn together or apart.",
    category_handle: "essence",
    thumbnail: img("essence", "golden-marquise", "main.webp"),
    images: productImagesWebp("essence", "golden-marquise"),
    weight: 3.75,
    features: {
      Stone: "Green Onyx",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "6.50 CT",
      "Silver Weight": "3.75 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("GLD-MRQ", 36.23),
  },
  // May II collection
  {
    handle: "ruby-trillion",
    title: "Ruby Trillion",
    description:
      "A vivid trillion-cut ruby sits at the heart of a bold zirconia halo — sparkling zirconia ringed by deep ruby pearls — all set in a striking silver-toned band.",
    category_handle: "essence",
    thumbnail: img("essence", "ruby-trillion", "main.webp"),
    images: productImagesWebp("essence", "ruby-trillion"),
    weight: 6.27,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "2.90 CT",
      "Silver Weight": "6.27 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RBY-TRL", 55.99),
  },
  // May II collection
  {
    handle: "blue-horizon",
    title: "Blue Horizon",
    description:
      "A deep sapphire blue center stone flanked by two sky blue topaz ovals, all set in a clean silver band for a cool, effortlessly elegant look.",
    category_handle: "essence",
    thumbnail: img("essence", "blue-horizon", "main.webp"),
    images: productImagesWebp("essence", "blue-horizon"),
    weight: 3.77,
    features: {
      Stone: "Sapphire",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "5.0 CT",
      "Silver Weight": "3.77 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLU-HRZ", 36.23),
  },
  // May II collection
  {
    handle: "red-horizon",
    title: "Red Horizon",
    description:
      "A deep ruby center stone flanked by two rose quartz ovals, all set in a clean silver band for a cool, effortlessly elegant look.",
    category_handle: "essence",
    thumbnail: img("essence", "red-horizon", "main.webp"),
    images: productImagesWebp("essence", "red-horizon"),
    weight: 3.54,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "8.00 CT",
      "Silver Weight": "3.54 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RED-HRZ", 36.23),
  },
  // May II collection
  {
    handle: "tanzanite-trillion",
    title: "Tanzanite Trillion",
    description:
      "A vivid trillion-cut tanzanite sits at the heart of a bold zirconia halo — sparkling zirconia ringed by blue pearls — all set in a striking silver-toned band.",
    category_handle: "essence",
    thumbnail: img("essence", "tanzanite-trillion", "main.webp"),
    images: productImagesWebp("essence", "tanzanite-trillion"),
    weight: 6.39,
    features: {
      Stone: "Tanzanite",
      "Stone Type": "ADD HERE",
      Color: "Blue / Purple",
      "Stone CT": "2.20 CT",
      "Silver Weight": "6.39 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("TZN-TRL", 59.28),
  },
  // May II collection
  {
    handle: "garnet-garnish",
    title: "Garnet Garnish",
    description:
      "Three oval-cut garnets nestled in glittering cubic zirconia halos, set in sterling silver for a timeless, regal elegance.",
    category_handle: "essence",
    thumbnail: img("essence", "garnet-garnish", "main.webp"),
    images: productImagesWebp("essence", "garnet-garnish"),
    weight: 4.0,
    features: {
      Stone: "Garnet",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "3.50 CT",
      "Silver Weight": "4.00 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("GRN-GRN", 46.11),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  May II Collection (Sparkles)
  // ═══════════════════════════════════════════════════════════════════════════
  // May II collection
  {
    handle: "ruby-reverie",
    title: "Ruby Reverie",
    description:
      "A zirconia flower cluster cascades into a sparkling baguette drop, finishing with a rich ruby teardrop wrapped in a halo — effortlessly dramatic.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "ruby-reverie", "main.webp"),
    images: productImagesWebp("sparkles", "ruby-reverie"),
    weight: 6.53,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "9.65 CT",
      "Silver Weight": "6.53 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RBY-RVR", 36.23),
  },
  // May II collection
  {
    handle: "crimson-descent",
    title: "Crimson Descent",
    description:
      "A pear-cut zirconia halo stud flows into a delicate baguette, dropping into a bold ruby teardrop — clean, linear, and quietly show-stopping.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "crimson-descent", "main.webp"),
    images: productImagesWebp("sparkles", "crimson-descent"),
    weight: 12.66,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "9.60 CT",
      "Silver Weight": "12.66 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("CRM-DSC", 98.81),
  },
  // May II collection
  {
    handle: "jade-and-ice",
    title: "Jade & Ice",
    description:
      "A zirconia-framed emerald-cut stud drops into an open teardrop halo cradling a lush green pear — bold geometry with a touch of old-world glamour.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "jade-and-ice", "main.webp"),
    images: productImagesWebp("sparkles", "jade-and-ice"),
    weight: 8.39,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "13.25 CT",
      "Silver Weight": "8.39 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("JDE-ICE", 82.34),
  },
  // May II collection
  {
    handle: "pink-oscillate",
    title: "Pink Oscillate",
    description:
      "Two long zirconia studded rectangle drops swing into a soft blush pink teardrop — sleek, modern, and just the right amount of bold.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "pink-oscillate", "main.webp"),
    images: productImagesWebp("sparkles", "pink-oscillate"),
    weight: 18.35,
    features: {
      Stone: "Rose Quartz",
      "Stone Type": "ADD HERE",
      Color: "Pink",
      "Stone CT": "12.80 CT",
      "Silver Weight": "18.35 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("PNK-OSC", 128.45),
  },
  // May II collection
  {
    handle: "ruby-bloom",
    title: "Ruby Bloom",
    description:
      "Two ruby halos — one stacked above the other — each bursting with a sunburst of zirconia, like a flower caught mid-bloom.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "ruby-bloom", "main.webp"),
    images: productImagesWebp("sparkles", "ruby-bloom"),
    weight: 8.26,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "14.80 CT",
      "Silver Weight": "8.26 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RBY-BLM", 71.14),
  },
  // May II collection
  {
    handle: "emerald-sun",
    title: "Emerald Sun",
    description:
      "A lush oval deep forest emerald ringed by a bold burst of zirconia petals — like a sunflower, but make it priceless.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "emerald-sun", "main.webp"),
    images: productImagesWebp("sparkles", "emerald-sun"),
    weight: 4.81,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "6.20 CT",
      "Silver Weight": "4.81 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMR-SUN", 51.38),
  },
  // May II collection
  {
    handle: "blue-oscillate",
    title: "Blue Oscillate",
    description:
      "Two long zirconia studded rectangle drops swing into a soft blush blue teardrop — sleek, modern, and just the right amount of bold.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "blue-oscillate", "main.webp"),
    images: productImagesWebp("sparkles", "blue-oscillate"),
    weight: 18.51,
    features: {
      Stone: "London Blue Topaz",
      "Stone Type": "ADD HERE",
      Color: "Blue",
      "Stone CT": "4.90 CT",
      "Silver Weight": "18.51 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("BLU-OSC", 128.45),
  },
  // May II collection
  {
    handle: "red-square",
    title: "Red Square",
    description:
      "A clean emerald-cut ruby hangs from a simple zirconia cluster on a classic lever-back — no fuss, just a deep red stone that does all the talking.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "red-square", "main.webp"),
    images: productImagesWebp("sparkles", "red-square"),
    weight: 2.86,
    features: {
      Stone: "Ruby",
      "Stone Type": "ADD HERE",
      Color: "Red",
      "Stone CT": "4.80 CT",
      "Silver Weight": "2.86 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("RED-SQR", 29.64),
  },
  // May II collection
  {
    handle: "empress-green",
    title: "Empress Green",
    description:
      "Oval emerald centre embraced by a double halo of sparkling zirconia and vivid green emerald rounds, set in lustrous sterling silver.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "empress-green", "main.webp"),
    images: productImagesWebp("sparkles", "empress-green"),
    weight: 7.13,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "3.95 CT",
      "Silver Weight": "7.13 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("EMP-GRN", 73.78),
  },
  // May II collection
  {
    handle: "velvet-verde",
    title: "Velvet Verde",
    description:
      "Cushion-cut emeralds draped in a single halo of brilliant zirconia rounds — where deep ocean green meets icy white fire.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "velvet-verde", "main.webp"),
    images: productImagesWebp("sparkles", "velvet-verde"),
    weight: 4.62,
    features: {
      Stone: "Emerald",
      "Stone Type": "ADD HERE",
      Color: "Green",
      "Stone CT": "4.95 CT",
      "Silver Weight": "4.62 gm",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VLV-VRD", 49.4),
  },
  // May II collection
  {
    handle: "verdant-horizon",
    title: "Verdant Horizon",
    description: "ADD HERE",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "verdant-horizon", "main.webp"),
    images: productImagesWebp("sparkles", "verdant-horizon"),
    weight: 0,
    features: {
      Stone: "ADD HERE",
      "Stone Type": "ADD HERE",
      Color: "ADD HERE",
      "Stone CT": "ADD HERE",
      "Silver Weight": "ADD HERE",
    },
    options: [MATERIAL_OPTION],
    variants: silverPanchadhatuVariants("VRD-HRZ", 50.0),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Initialising Aurora Jewel database...\n");
  await initDatabase();

  // ── Admin credentials info ──────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || "admin@aurorajewelstudio.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "aurora123";
  console.log("🔐 Admin Credentials (from .env):");
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log(`   URL:      http://localhost:3000/admin\n`);

  // ── Clear existing products (fresh seed) ────────────────────────────────
  console.log("🗑️  Clearing existing products...");
  await query("DELETE FROM products");

  // ── Products ────────────────────────────────────────────────────────────
  console.log("📦 Seeding products...\n");
  let inserted = 0;

  for (const p of PRODUCTS) {
    const silverVariant =
      p.variants.find((v) => v.options["Material"] === "Silver") ||
      p.variants[0];
    const basePrice = silverVariant?.prices?.usd || 0;

    await query(
      `INSERT INTO products
         (handle, title, description, price, currency, thumbnail, images, options, variants, category_handle, weight, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb)`,
      [
        p.handle,
        p.title,
        p.description,
        basePrice,
        "usd",
        p.thumbnail,
        JSON.stringify(p.images || []),
        JSON.stringify(p.options || []),
        JSON.stringify(p.variants || []),
        p.category_handle,
        p.weight || null,
        JSON.stringify(p.features || {}),
      ],
    );

    console.log(
      `   ✅ ${p.title} — ${p.category_handle} — USD $${basePrice.toLocaleString()}`,
    );
    inserted++;
  }

  console.log(`\n✨ Done! ${inserted} products seeded.`);
  console.log("\n📊 Summary by collection:");

  const collections: Record<string, number> = {};
  for (const p of PRODUCTS) {
    collections[p.category_handle] = (collections[p.category_handle] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(collections)) {
    console.log(`   ${cat}: ${count} products`);
  }

  console.log("\n🚀 Next steps:");
  console.log("   1. Start the backend:  npm run dev");
  console.log("   2. Build storefront:   cd ../storefront && npm run build");
  console.log("   3. Upload out/ folder to Hostinger public_html.\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
