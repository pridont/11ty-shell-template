/**
 * AI crawler policy, split by what each operator says its crawler is *for*.
 *
 * The split is possible because the major vendors now ship separate tokens for
 * separate uses, and document them:
 *   - OpenAI    — GPTBot trains; OAI-SearchBot indexes for ChatGPT search.
 *   - Anthropic — ClaudeBot trains; Claude-SearchBot indexes; Claude-User fetches
 *                 a page because someone asked for it.
 *   - Google    — Google-Extended governs Gemini training only, and Google states
 *                 it is not a Search ranking signal, so blocking it costs nothing
 *                 in Search.
 *   - Apple     — Applebot-Extended is the training opt-out; Applebot itself still
 *                 feeds Siri and Spotlight.
 *
 * Caveats worth knowing before treating this as protection:
 *   1. robots.txt is voluntary. It is a request, not a control. Anything willing
 *      to ignore it or spoof a user agent is unaffected — that needs edge blocking.
 *   2. The training/search boundary is the vendor's own claim about its own bot.
 *   3. Blocking a training bot does not retroactively remove already-crawled data.
 */

// Disallowed: crawlers whose stated job is collecting corpora for model training,
// or building datasets sold onward for that purpose.
export const training = [
  // OpenAI
  "GPTBot",
  // Anthropic — ClaudeBot is current; the other two are legacy tokens kept because
  // older infrastructure may still send them.
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  // Google — Gemini training and grounding. Explicitly not a Search ranking signal.
  "Google-Extended",
  "Google-CloudVertexBot",
  // Apple — the training opt-out only. Applebot (Siri, Spotlight) is allowed below.
  "Applebot-Extended",
  // Meta — FacebookBot and Meta-ExternalAgent train models. facebookexternalhit,
  // which renders link previews from the og: tags, is deliberately not blocked.
  "Meta-ExternalAgent",
  "FacebookBot",
  // Common Crawl — not a model trainer itself, but its archive is the single most
  // widely reused source of training data on the web.
  "CCBot",
  // ByteDance
  "Bytespider",
  "TikTokSpider",
  // Everyone else who says, on the record, that the crawl feeds model training or a
  // dataset sold for it.
  "AI2Bot",
  "Ai2Bot-Dolma",
  "cohere-ai",
  "cohere-training-data-crawler",
  "DeepSeekBot",
  "Diffbot",
  "ICC-Crawler",
  "ImagesiftBot",
  "LAIONDownloader",
  "omgili",
  "omgilibot",
  "PanguBot",
  "Timpibot",
  // Dual-use, blocked on the training half of the claim: Amazonbot feeds Alexa
  // answers *and* service improvement, YouBot feeds You.com search *and* its LLMs.
  // Neither separates the two into distinct tokens, so there is no way to allow the
  // search half alone.
  "Amazonbot",
  "YouBot",
];

// Allowed: crawlers that build the indexes AI answers cite from, or that fetch a
// single page because a user asked a question about it. These are how a site gets
// surfaced and linked rather than absorbed.
export const aiSearch = [
  // OpenAI
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic
  "Claude-SearchBot",
  "Claude-User",
  // Perplexity — documents that neither token feeds foundation-model training.
  "PerplexityBot",
  "Perplexity-User",
  // Apple search: Siri and Spotlight.
  "Applebot",
  // DuckDuckGo AI answers.
  "DuckAssistBot",
  // Mistral, user-initiated.
  "MistralAI-User",
  // Meta, user-initiated fetch (distinct from Meta-ExternalAgent above).
  "Meta-ExternalFetcher",
];

export default { training, aiSearch };
