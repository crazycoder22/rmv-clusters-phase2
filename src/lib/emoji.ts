/** Ordered keyword-to-emoji map. First match wins. Case-insensitive. */
const KEYWORD_EMOJI_MAP: [string[], string][] = [
  // Indian festivals & celebrations
  [["diwali", "deepavali"], "\u{1FA94}"], // 🪔
  [["holi"], "\u{1F3A8}"], // 🎨
  [["christmas", "xmas"], "\u{1F384}"], // 🎄
  [["new year", "new yearr"], "\u{1F389}"], // 🎉
  [["eid"], "\u{1F319}"], // 🌙
  [["pongal", "sankranti", "harvest"], "\u{1F33E}"], // 🌾
  [["navarathri", "navratri", "garba", "dandiya"], "\u{1FA94}"], // 🪔
  [["independence day", "republic day"], "\u{1F1EE}\u{1F1F3}"], // 🇮🇳
  [["ganesh", "ganpati", "vinayaka"], "\u{1F418}"], // 🐘
  [["onam"], "\u{1F6F6}"], // 🛶
  [["raksha", "rakhi"], "\u{1F9F5}"], // 🧵
  [["ugadi", "gudi padwa"], "\u{1F343}"], // 🍃
  [["kannada rajyotsava", "rajyotsava"], "\u{1F3F3}\u{FE0F}"], // 🏳️

  // Community events
  [["talkshow", "talk show", "talk"], "\u{1F3A4}"], // 🎤
  [["sos", "emergency", "alert"], "\u{1F6A8}"], // 🚨
  [["meeting", "agm", "general body"], "\u{1F4CB}"], // 📋
  [["election", "voting"], "\u{1F5F3}\u{FE0F}"], // 🗳️
  [["get-together", "get together", "gathering"], "\u{1F91D}"], // 🤝
  [["potluck"], "\u{1F372}"], // 🍲
  [["barbecue", "bbq", "grill"], "\u{1F525}"], // 🔥
  [["picnic"], "\u{1F9FA}"], // 🧺
  [["movie", "film", "screening"], "\u{1F3AC}"], // 🎬
  [["music", "concert", "band"], "\u{1F3B5}"], // 🎵
  [["karaoke"], "\u{1F3A4}"], // 🎤
  [["dance"], "\u{1F483}"], // 💃
  [["yoga", "meditation"], "\u{1F9D8}"], // 🧘
  [["fitness", "gym", "workout", "zumba"], "\u{1F4AA}"], // 💪
  [["stepup", "step up", "step challenge", "mini-stepup"], "\u{1F45F}"], // 👟
  [["walk", "walkathon", "marathon", "run"], "\u{1F6B6}"], // 🚶

  // Sports
  [["cricket"], "\u{1F3CF}"], // 🏏
  [["volleyball"], "\u{1F3D0}"], // 🏐
  [["throwball"], "\u{1F3D0}"], // 🏐
  [["badminton", "shuttle"], "\u{1F3F8}"], // 🏸
  [["football", "soccer"], "\u{26BD}"], // ⚽
  [["tennis"], "\u{1F3BE}"], // 🎾
  [["swimming", "pool"], "\u{1F3CA}"], // 🏊
  [["sports fest", "sports day"], "\u{1F3C5}"], // 🏅
  [["tournament", "championship"], "\u{1F3C6}"], // 🏆
  [["carrom"], "\u{1F3AF}"], // 🎯
  [["chess"], "\u{265F}\u{FE0F}"], // ♟️
  [["table tennis", "ping pong"], "\u{1F3D3}"], // 🏓

  // Kids
  [["kids", "children", "child"], "\u{1F476}"], // 👶
  [["drawing", "painting", "art"], "\u{1F3A8}"], // 🎨
  [["talent show", "talent"], "\u{2B50}"], // ⭐
  [["fancy dress", "costume"], "\u{1F3AD}"], // 🎭

  // Maintenance & ops
  [["maintenance"], "\u{1F527}"], // 🔧
  [["cleaning", "clean-up", "cleanup"], "\u{1F9F9}"], // 🧹
  [["water", "tank", "plumbing"], "\u{1F4A7}"], // 💧
  [["electricity", "power", "electrical"], "\u{26A1}"], // ⚡
  [["pest control", "fumigation"], "\u{1F41B}"], // 🐛
  [["lift", "elevator"], "\u{1F6D7}"], // 🛗
  [["garden", "landscaping", "plantation"], "\u{1F33F}"], // 🌿
  [["security"], "\u{1F512}"], // 🔒

  // Food & dining
  [["breakfast"], "\u{1F373}"], // 🍳
  [["lunch", "dinner", "feast", "buffet", "food"], "\u{1F37D}\u{FE0F}"], // 🍽️
  [["tea", "chai"], "\u{2615}"], // ☕
  [["cake", "birthday"], "\u{1F382}"], // 🎂
  [["ice cream"], "\u{1F366}"], // 🍦

  // Other
  [["workshop"], "\u{1F6E0}\u{FE0F}"], // 🛠️
  [["seminar", "webinar"], "\u{1F393}"], // 🎓
  [["camp"], "\u{26FA}"], // ⛺
  [["trip", "outing", "excursion", "tour"], "\u{1F68C}"], // 🚌
  [["blood donation", "health camp", "medical"], "\u{1F3E5}"], // 🏥
  [["awareness"], "\u{1F4E2}"], // 📢
  [["registration", "enrollment"], "\u{1F4DD}"], // 📝
  [["holiday", "vacation"], "\u{1F3D6}\u{FE0F}"], // 🏖️
  [["prayer", "pooja", "puja"], "\u{1F64F}"], // 🙏
  [["inauguration", "opening", "launch"], "\u{1F380}"], // 🎀
  [["farewell"], "\u{1F44B}"], // 👋
  [["welcome"], "\u{1F64C}"], // 🙌
  [["celebration"], "\u{1F389}"], // 🎉
];

/** Default emoji when no keyword matches */
const DEFAULT_EMOJI = "\u{1F4CC}"; // 📌

/**
 * Auto-detect an emoji for an event title by scanning keywords.
 * Returns the first matching emoji or the default.
 */
export function detectEmoji(title: string): string {
  const lower = title.toLowerCase();
  for (const [keywords, emoji] of KEYWORD_EMOJI_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return emoji;
    }
  }
  return DEFAULT_EMOJI;
}

/**
 * Get the effective emoji for an event:
 * Use the stored emoji if present, otherwise auto-detect from title.
 */
export function getEffectiveEmoji(
  title: string,
  storedEmoji?: string | null
): string {
  if (storedEmoji && storedEmoji.trim()) return storedEmoji;
  return detectEmoji(title);
}
