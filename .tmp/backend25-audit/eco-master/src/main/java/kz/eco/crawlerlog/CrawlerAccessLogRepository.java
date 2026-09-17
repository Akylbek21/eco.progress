package kz.eco.crawlerlog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CrawlerAccessLogRepository extends JpaRepository<CrawlerAccessLog, Long> {
    List<CrawlerAccessLog> findAllByCrawlerNameOrderByRequestedAtDesc(String crawlerName);

    List<CrawlerAccessLog> findAllByOrderByRequestedAtDesc();
}
