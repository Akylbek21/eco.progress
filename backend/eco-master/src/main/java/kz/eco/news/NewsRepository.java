package kz.eco.news;

import kz.eco.content.ContentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NewsRepository extends JpaRepository<News, String> {
    List<News> findAllByOrderByPublishedAtDesc();

    List<News> findAllByReviewStatusInOrderByPublishedAtDesc(List<ContentStatus> reviewStatuses);
}
