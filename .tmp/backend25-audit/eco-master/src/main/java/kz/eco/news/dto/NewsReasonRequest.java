package kz.eco.news.dto;

/** Body for returnForRevision/revokeApproval - reason and version are both mandatory server-side
 *  regardless of what the client sends (see kz.eco.news.NewsService). */
public record NewsReasonRequest(String reason, Long version) {
}
