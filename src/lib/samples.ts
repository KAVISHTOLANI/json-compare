export const SAMPLE_LEFT = `{
  "order": "A-10293",
  "status": "processing",
  "customer": { "name": "Demo Customer", "email": "customer@example.com", "vip": false },
  "items": [
    { "sku": "MUG-01", "name": "Stoneware mug", "qty": 2, "price": 14.5 },
    { "sku": "TEA-12", "name": "Loose-leaf tea, 100 g", "qty": 1, "price": 9.25 }
  ],
  "shipping": { "method": "standard", "cost": 4.99 },
  "notes": null,
  "total": 43.24
}`;

export const SAMPLE_RIGHT = `{
  "order": "A-10293",
  "status": "shipped",
  "customer": { "name": "Demo Customer", "email": "customer@example.com", "vip": "false" },
  "items": [
    { "sku": "TEA-12", "name": "Loose-leaf tea, 100 g", "qty": 2, "price": 9.25 },
    { "sku": "MUG-01", "name": "Stoneware mug", "qty": 2, "price": 14.5 },
    { "sku": "SPN-03", "name": "Brass tea spoon", "qty": 1, "price": 6 }
  ],
  "shipping": { "method": "express", "cost": 9.99, "tracking": "DEMO123456" },
  "total": 73.49,
  "updatedAt": "2026-03-04T10:12:00Z"
}`;
