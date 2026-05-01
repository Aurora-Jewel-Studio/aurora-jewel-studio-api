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
 *   - main.jpg   → thumbnail
 *   - side1.jpg  → gallery image 1
 *   - side2.jpg  → gallery image 2
 *
 * ADMIN CREDENTIALS are loaded from .env (ADMIN_EMAIL, ADMIN_PASSWORD)
 * Default: admin@aurorajewel.com / aurora123
 */

import { initDatabase, query } from "./db";
import dotenv from "dotenv";

dotenv.config();

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
  const images = [{ url: img(category, handle, "main.jpg") }];
  for (let i = 1; i <= sideCount; i++) {
    images.push({ url: img(category, handle, `side${i}.jpg`) });
  }
  return images;
}

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
    prices: { npr: number };
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
      title: "Silver",
      sku: `${sku}-SLV`,
      options: { Material: "Silver" },
      prices: { npr: silverPrice },
    },
    {
      title: "Panchadhatu",
      sku: `${sku}-PANCH`,
      options: { Material: "Panchadhatu" },
      prices: { npr: Math.round(silverPrice * 0.6) },
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
    thumbnail: img("drops", "victorian-reverie", "main.jpg"),
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
    variants: silverPanchadhatuVariants("VICT-REV", 18500),
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
    thumbnail: img("nexus", "blush-bloom", "main.jpg"),
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
    variants: silverPanchadhatuVariants("BLSH-BLM", 12000),
  },
  {
    handle: "delicate-balance",
    title: "Delicate Balance",
    description:
      "Lustrous cream pearls nestle between diamond-studded spirals in this gracefully twisted open bangle, merging classic elegance with a modern appeal.",
    category_handle: "nexus",
    thumbnail: img("nexus", "delicate-balance", "main.jpg"),
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
    variants: silverPanchadhatuVariants("DLCT-BAL", 9500),
  },
  {
    handle: "timeless-tale",
    title: "Timeless Tale",
    description:
      "A mint green onyx square and luminous pearl harmonize on a delicately textured gold bracelet, creating a refined pairing of elegant and aesthetic.",
    category_handle: "nexus",
    thumbnail: img("nexus", "timeless-tale", "main.jpg"),
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
    variants: silverPanchadhatuVariants("TMLS-TLE", 15000),
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
    thumbnail: img("essence", "bold-harmony", "main.jpg"),
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
    variants: silverPanchadhatuVariants("BLD-HRM", 14500),
  },
  {
    handle: "hex-touch",
    title: "Hex Touch",
    description:
      "A delicate gold-polished band crowned with a vivid hexagonal green cubic zirconia, where modern geometry meets timeless elegance.",
    category_handle: "essence",
    thumbnail: img("essence", "hex-touch", "main.jpg"),
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
    variants: silverPanchadhatuVariants("HEX-TCH", 11000),
  },
  {
    handle: "onyx-glide",
    title: "Onyx Glide",
    description:
      "Statement ring showcasing a graceful row of rich green onyx cabochons elegantly framed by brilliant cubic zirconia-studded bands in soft gold-plated tone creating flair & grace.",
    category_handle: "essence",
    thumbnail: img("essence", "onyx-glide", "main.jpg"),
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
    variants: silverPanchadhatuVariants("ONX-GLD", 13000),
  },
  {
    handle: "royal-violet",
    title: "Royal Violet",
    description:
      "Satement ring featuring a magnificent emerald-cut amethyst centerpiece in rich violet hues, dramatically flanked by brilliant aqua-blue topaz stones in a vintage three-stone design.",
    category_handle: "essence",
    thumbnail: img("essence", "royal-violet", "main.jpg"),
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
    variants: silverPanchadhatuVariants("RYL-VLT", 16000),
  },
  {
    handle: "soft-serenity",
    title: "Soft Serenity",
    description:
      "Luminous zirconia in soft pastels meets sparkling pave accents, creating an ethereal collection that captures the delicate design for this ring.",
    category_handle: "essence",
    thumbnail: img("essence", "soft-serenity", "main.jpg"),
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
    variants: silverPanchadhatuVariants("SFT-SRN", 9000),
  },
  {
    handle: "trinity-crest",
    title: "Trinity Crest",
    description:
      "Contemporary ring showcasing a trillion cut royal red gemstone with exceptional clarity and depth, arranged in a classic yet modern sleek setting to make a statement piece.",
    category_handle: "essence",
    thumbnail: img("essence", "trinity-crest", "main.jpg"),
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
    variants: silverPanchadhatuVariants("TRNT-CRS", 19500),
  },
  {
    handle: "verdant-dream",
    title: "Verdant Dream",
    description:
      "A luminous trillion-cut green gemstone sits in a gracefully split gold band, blending organic elegance with the captivating brilliance of tropical design.",
    category_handle: "essence",
    thumbnail: img("essence", "verdant-dream", "main.jpg"),
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
    variants: silverPanchadhatuVariants("VRDN-DRM", 13500),
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
    thumbnail: img("sparkles", "black-harmony", "main.jpg"),
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
    variants: silverPanchadhatuVariants("BLK-HRM", 10500),
  },
  {
    handle: "blooming-charm",
    title: "Blooming Charm",
    description:
      "Curved stud earrings showcasing cascading flower motifs in gradient pink tourmaline reating an elegant botanical statement that follows the natural curve of the ear.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "blooming-charm", "main.jpg"),
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
    variants: silverPanchadhatuVariants("BLM-CRM", 8500),
  },
  {
    handle: "blue-majesty",
    title: "Blue Majesty",
    description:
      "Regal cuts anchor a dazzling cluster of blue and white crystals, creating an exquisite masterpiece with an icy foundation & a deep oceanic touch.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "blue-majesty", "main.jpg"),
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
    variants: silverPanchadhatuVariants("BLU-MJT", 16500),
  },
  {
    handle: "chandelier-spark",
    title: "Chandelier Spark",
    description:
      "Cascading green cubic zirconia teardrops framed in a show-stopping chandelier effect with contemporary radiance for unforgettable elegance.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "chandelier-spark", "main.jpg"),
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
    variants: silverPanchadhatuVariants("CHND-SPK", 18000),
  },
  {
    handle: "circle-celeste",
    title: "Circle Celeste",
    description:
      "A jeweled constellation orbits within polished gold hoops, blending sapphire, pink tourmaline, and emerald in a playfully sophisticated celestial dance.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "circle-celeste", "main.jpg"),
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
    variants: silverPanchadhatuVariants("CRC-CLT", 12000),
  },
  {
    handle: "dazzle-drops",
    title: "Dazzle Drops",
    description:
      "Stunning handmade three-stone drop earrings featuring a captivating gradient of turquoise blue, soft rose pink, and rich emerald green onyx framed with sparkling crystal halos for an elegant, eye-catching design.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "dazzle-drops", "main.jpg"),
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
    variants: silverPanchadhatuVariants("DZL-DRP", 11500),
  },
  {
    handle: "oceanic-ombre",
    title: "Oceanic Ombré",
    description:
      "Aqua cushion-cut topaz cascades through emerald pavé bands to luminous teardrops, creating a breathtaking gradient from sky to sea in one exquisite design.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "oceanic-ombré ", "main.jpg"),
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
    variants: silverPanchadhatuVariants("OCN-OMB", 14000),
  },
  {
    handle: "purple-symphony",
    title: "Purple Symphony",
    description:
      "Luminous amethyst teardrops crowned with rose gold squares to create a gracefully graduated silhouette, merging regal purple hues with contemporary sophistication.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "purple-symphony", "main.jpg"),
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
    variants: silverPanchadhatuVariants("PRPL-SYM", 13500),
  },
  {
    handle: "regal-magnifique",
    title: "Regal Magnifique",
    description:
      "Magnificent emerald-cut green crystals cascade through brilliant diamonds to royal blue teardrops, creating a breathtaking statement of jewel-toned opulence and timeless drama.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "regal-magnifique", "main.jpg"),
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
    variants: silverPanchadhatuVariants("RGL-MGN", 22000),
  },
  {
    handle: "vintage-shine",
    title: "Vintage Shine",
    description:
      "Magnificent vintage-inspired earrings featuring a dramatic bow and ribbon design, adorned with vibrant ruby-red gemstones in an elegant Art Deco style.",
    category_handle: "sparkles",
    thumbnail: img("sparkles", "vintage-shine", "main.jpg"),
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
    variants: silverPanchadhatuVariants("VNT-SHN", 13000),
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
    thumbnail: img("radiance", "celest-charm", "main.jpg"),
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
    variants: silverPanchadhatuVariants("CLST-CRM", 8000),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  //  EMBLEM (Coat Decoration)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    handle: "feather-poise",
    title: "Feather Poise",
    description:
      "Feather-inspired brooch showcasing delicate curved lines adorned with brilliant crystals and crowned by a vivid blue centerpiece in a lustrous silver tone.",
    category_handle: "emblem",
    thumbnail: img("emblem", "feather-poise", "main.jpg"),
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
    variants: silverPanchadhatuVariants("FTHR-POS", 9500),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("🌱 Initialising Aurora Jewel database...\n");
  await initDatabase();

  // ── Admin credentials info ──────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || "admin@aurorajewel.com";
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
    const basePrice = silverVariant?.prices?.npr || 0;

    await query(
      `INSERT INTO products
         (handle, title, description, price, currency, thumbnail, images, options, variants, category_handle, weight, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb)`,
      [
        p.handle,
        p.title,
        p.description,
        basePrice,
        "npr",
        p.thumbnail,
        JSON.stringify(p.images || []),
        JSON.stringify(p.options || []),
        JSON.stringify(p.variants || []),
        p.category_handle,
        p.weight || null,
        JSON.stringify(p.features || {})
      ],
    );

    console.log(
      `   ✅ ${p.title} — ${p.category_handle} — NPR ${basePrice.toLocaleString()}`,
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
