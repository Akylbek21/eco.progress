package kz.eco.geo;

import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.content.ContentVersioning;
import kz.eco.geo.dto.CreateGeoMonitoredQueryRequest;
import kz.eco.geo.dto.GeoMonitoredQueryDto;
import kz.eco.geo.dto.RecordCheckRequest;
import kz.eco.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** GEO Query Monitor (Analytics item 3) - a curated list of real queries and their last-known
 *  visibility state. Deliberately no automated Google/ChatGPT scraper: {@link #recordCheck} is the
 *  only way results change, and it is only ever called by a human editor via the admin API (or,
 *  later, an explicitly allowed integration such as the Search Console generative-AI report) -
 *  never by a background job that would violate those services' terms. */
@Service
public class GeoMonitoredQueryService {

    private final GeoMonitoredQueryRepository repository;

    public GeoMonitoredQueryService(GeoMonitoredQueryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<GeoMonitoredQueryDto> findAll() {
        return repository.findAll().stream().map(GeoMonitoredQueryDto::from).toList();
    }

    @Transactional
    public GeoMonitoredQueryDto create(CreateGeoMonitoredQueryRequest request) {
        if (request.query() == null || request.query().isBlank()) {
            throw new BadRequestException("Укажите текст запроса", "QUERY_REQUIRED");
        }
        GeoMonitoredQuery q = new GeoMonitoredQuery();
        q.setQuery(request.query());
        q.setCategory(request.category());
        q.setServiceId(request.serviceId());
        q.setCitySlug(request.citySlug());
        q.setIntent(parseIntent(request.intent()));
        return GeoMonitoredQueryDto.from(repository.saveAndFlush(q));
    }

    @Transactional
    public GeoMonitoredQueryDto recordCheck(Long id, RecordCheckRequest request, User actor) {
        GeoMonitoredQuery q = getOrThrow(id);
        ContentVersioning.requireCurrentVersion(q.getVersion(), request.version());
        q.setOurBrandMentioned(request.ourBrandMentioned());
        q.setOurUrlCited(request.ourUrlCited());
        q.setCompetitors(request.competitors() == null ? new ArrayList<>() : new ArrayList<>(request.competitors()));
        q.setLastCheckedAt(Instant.now());
        q.setCheckedBy(actor.getId());
        return GeoMonitoredQueryDto.from(repository.saveAndFlush(q));
    }

    private GeoMonitoredQuery getOrThrow(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Запрос не найден: " + id));
    }

    private QueryIntent parseIntent(String value) {
        try {
            return QueryIntent.valueOf(value);
        } catch (Exception ex) {
            throw new BadRequestException("Неизвестный intent: " + value, "UNKNOWN_INTENT");
        }
    }
}
