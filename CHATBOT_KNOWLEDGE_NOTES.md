# Aura knowledge issues requiring owner confirmation

- **Returns conflict:** the chatbot policy draft says all general returns are unavailable and defects receive an exchange, while the current storefront allows ready-made returns within 7 days and a replacement or refund for damage reported within 48 hours. Chat currently follows the storefront.
- **International shipping conflict:** the draft says a standard worldwide fee is added at checkout; the storefront says international shipping is by request and quote. Chat currently follows the storefront.
- **Availability conflict:** the draft says every piece is made to order and cannot run out; the storefront terms allow cancellation when a product is out of stock, and the products table has no availability field. Chat never claims availability.
- **Catalog drift:** the consultant catalog has 67 entries while the current seed has 76 products. Live database records control product IDs, URLs, prices, and cards.
- **Unverified policy claims:** silver warranty/buyback, any-carat plating, engraving, gift packaging, COD/installments, shipping liability, and complimentary cleaning need an approved customer-facing policy source before launch.
- **Sizing:** the HTML says its conversions use standard references rather than Aurora fabrication measurements; those values need maker approval. It also contains a Cyrillic character in “Chhotе jhumka.”
- **Content encoding:** `Oceanic OmbrÃ©` is malformed in the source product catalog. Runtime retrieval repairs the display text without changing the source file.
- **Product materials:** the draft describes every piece as 925 sterling silver by default, but current products also expose Panchadhatu variants. Product-level material and allergy data are incomplete, so chat does not make nickel-free or hypoallergenic claims.
