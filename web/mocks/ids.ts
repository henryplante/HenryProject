function seedId(kind: number, n: number) {
  const k = kind.toString(16).padStart(8, "0");
  const i = n.toString(16).padStart(12, "0");
  return `${k}-0000-4000-8000-${i}`;
}

const userKeys = [
  "maya",
  "james",
  "sofia",
  "alex",
  "jordan",
  "morgan",
  "riley",
  "casey",
] as const;
const groupKeys = ["marketing", "legal", "compliance"] as const;
const productKeys = ["personalLoans", "creditCards", "mortgage"] as const;
const materialKeys = [
  "draft",
  "approved",
  "expired",
  "expiredNotified",
  "obsolete",
  "expiring",
  "step2",
  "promo",
  "walkthrough",
  "cards",
] as const;

export type SeedUserKey = (typeof userKeys)[number];
export type SeedGroupKey = (typeof groupKeys)[number];
export type SeedProductKey = (typeof productKeys)[number];
export type SeedMaterialKey = (typeof materialKeys)[number];

function index<K extends string>(keys: readonly K[], kind: number) {
  return Object.fromEntries(
    keys.map((key, i) => [key, seedId(kind, i + 1)]),
  ) as Record<K, string>;
}

export const SEED_IDS = {
  users: index(userKeys, 1),
  groups: index(groupKeys, 2),
  products: index(productKeys, 3),
  materials: index(materialKeys, 4),
  versions: Object.fromEntries(
    materialKeys.map((key, i) => [
      key,
      [seedId(5, i * 10 + 1), seedId(5, i * 10 + 2)],
    ]),
  ) as Record<SeedMaterialKey, [string, string]>,
};

export const SEED_PASSWORD = "demo-demo";
export const SEED_EMAIL_DOMAIN = "@clearpath.example";
export const WALKTHROUGH_TITLE = "Affiliate personal loan offer — spring email";

export const SEED_USER_KEYS = userKeys;
export const SEED_MATERIAL_KEYS = materialKeys;

export function seedEmail(key: SeedUserKey) {
  const names: Record<SeedUserKey, string> = {
    maya: "maya.chen",
    james: "james.rivera",
    sofia: "sofia.patel",
    alex: "alex.kim",
    jordan: "jordan.lee",
    morgan: "morgan.taylor",
    riley: "riley.davis",
    casey: "casey.brooks",
  };
  return `${names[key]}${SEED_EMAIL_DOMAIN}`;
}
