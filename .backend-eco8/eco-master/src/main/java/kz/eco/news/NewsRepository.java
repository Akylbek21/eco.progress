package kz.eco.news;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NewsRepository extends JpaRepository<News, String> {
    List<News> findAllByOrderByPublishedAtDesc();
}
