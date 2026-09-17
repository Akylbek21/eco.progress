package kz.eco.geo;

/** Distinct traffic-attribution buckets (Analytics item 1: "не смешивать GEO с обычной
 *  Google-позицией") - each is tracked and reported separately, never rolled up into one blended
 *  "search visibility" number. */
public enum GeoReferralSource {
    GOOGLE_ORGANIC,
    GOOGLE_AI_OVERVIEW,
    CHATGPT_REFERRAL,
    BING_COPILOT_REFERRAL,
    AI_CITATION
}
