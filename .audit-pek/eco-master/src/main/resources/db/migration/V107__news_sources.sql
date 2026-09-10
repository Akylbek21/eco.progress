-- Structured source citations for news articles.
-- Stored as an ordered list of URLs/text so the frontend can render them as visible <cite>
-- elements and NewsSeoService can include them in Article JSON-LD as citedBy/citation.
CREATE TABLE news_sources (
    news_id   VARCHAR(80)  NOT NULL REFERENCES news(id) ON DELETE CASCADE,
    ord       INTEGER      NOT NULL,
    item_value VARCHAR(600) NOT NULL,
    PRIMARY KEY (news_id, ord)
);
