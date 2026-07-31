package kz.eco.news;

import kz.eco.common.exception.NotFoundException;
import kz.eco.news.dto.NewsResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NewsService {

    private final NewsRepository repository;

    public NewsService(NewsRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<NewsResponse> findAll() {
        return repository.findAllByOrderByPublishedAtDesc().stream()
                .map(NewsResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public NewsResponse findById(String id) {
        return repository.findById(id)
                .map(NewsResponse::from)
                .orElseThrow(() -> new NotFoundException("Новость не найдена: " + id));
    }
}
