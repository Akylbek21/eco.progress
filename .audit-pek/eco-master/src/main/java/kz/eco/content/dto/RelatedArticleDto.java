package kz.eco.content.dto;

/** Internal-linking entry pointing at a News article. Only ever built from APPROVED/PUBLISHED
 *  (indexable) articles - see ServiceCityPageService#relatedArticles() - so an indexable city page
 *  can never link to a noindex article. */
public record RelatedArticleDto(String id, String title, String url) {
}
