package kz.eco.geo;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.List;

/** Seeds the GEO Query Monitor (Analytics item 3) with a starter set of real, representative
 *  queries covering the company's core services/cities/intents. This is the "заносить результаты
 *  проверки вручную" starting point - lastCheckedAt/ourBrandMentioned/ourUrlCited/competitors are
 *  left at their defaults (never checked yet) until an editor records an actual check via
 *  POST /api/admin/analytics/geo-queries/{id}/record-check. No scraping happens here or anywhere
 *  else in this module. */
@Component
@Order(100)
public class GeoMonitoredQuerySeeder implements CommandLineRunner {

    private final GeoMonitoredQueryRepository repository;

    public GeoMonitoredQuerySeeder(GeoMonitoredQueryRepository repository) {
        this.repository = repository;
    }

    private record Seed(String query, String category, String serviceId, String citySlug, QueryIntent intent) {
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) return;

        List<Seed> seeds = List.of(
                // НДВ (нормативы допустимых выбросов)
                new Seed("Кому нужен проект НДВ?", "НДВ", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Сколько стоит проект НДВ в Шымкенте?", "НДВ", null, "shymkent", QueryIntent.COMMERCIAL),
                new Seed("Сколько стоит проект НДВ в Алматы?", "НДВ", null, "almaty", QueryIntent.COMMERCIAL),
                new Seed("Нужен ли НДВ для склада?", "НДВ", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Нужен ли НДВ для АЗС?", "НДВ", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Срок действия проекта НДВ", "НДВ", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Кто разрабатывает проект НДВ в Казахстане?", "НДВ", null, null, QueryIntent.COMMERCIAL),
                new Seed("Штраф за отсутствие проекта НДВ", "НДВ", null, null, QueryIntent.INFORMATIONAL),

                // Категория объекта / экологическая отчетность
                new Seed("Как определить категорию объекта?", "Категория объекта", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Что сдавать по экологии для объекта II категории?", "Отчетность", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Разница между I и II категорией объекта", "Категория объекта", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Как перейти из III категории во II?", "Категория объекта", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Экологическая отчетность для малого бизнеса", "Отчетность", null, null, QueryIntent.INFORMATIONAL),

                // ПЭК
                new Seed("Что входит в ПЭК?", "ПЭК", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Программа экологического контроля - сколько стоит", "ПЭК", null, null, QueryIntent.COMMERCIAL),
                new Seed("Кто разрабатывает программу ПЭК", "ПЭК", null, null, QueryIntent.COMMERCIAL),
                new Seed("Периодичность отчета по ПЭК", "ПЭК", null, null, QueryIntent.INFORMATIONAL),
                new Seed("ПЭК для предприятия в Караганде", "ПЭК", null, "karaganda", QueryIntent.LOCAL),

                // Экологический паспорт
                new Seed("Кто делает экологический паспорт?", "Экологический паспорт", null, null, QueryIntent.COMMERCIAL),
                new Seed("Экологический паспорт предприятия - что это", "Экологический паспорт", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Срок оформления экологического паспорта", "Экологический паспорт", null, null, QueryIntent.INFORMATIONAL),

                // Услуги по городам
                new Seed("Экологические услуги в Алматы", "Услуги в городе", null, "almaty", QueryIntent.LOCAL),
                new Seed("Экологические услуги в Астане", "Услуги в городе", null, "astana", QueryIntent.LOCAL),
                new Seed("Экологическая компания в Шымкенте", "Услуги в городе", null, "shymkent", QueryIntent.LOCAL),
                new Seed("Экологические услуги в Семее", "Услуги в городе", null, "semey", QueryIntent.LOCAL),
                new Seed("Экологическая экспертиза в Караганде", "Услуги в городе", null, "karaganda", QueryIntent.LOCAL),

                // Лаборатория
                new Seed("Лаборатория замеров воздуха в Шымкенте", "Лаборатория", null, "shymkent", QueryIntent.LOCAL),
                new Seed("Аккредитованная экологическая лаборатория Алматы", "Лаборатория", null, "almaty", QueryIntent.LOCAL),
                new Seed("Замеры выбросов на источнике - сколько стоит", "Лаборатория", null, null, QueryIntent.COMMERCIAL),
                new Seed("Лабораторный контроль сточных вод", "Лаборатория", null, null, QueryIntent.COMMERCIAL),

                // Общие/бренд
                new Seed("ECOPROGRESS GROUP отзывы", "Бренд", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Лучшая экологическая компания Казахстана", "Бренд", null, null, QueryIntent.COMMERCIAL),
                new Seed("Экологический аудит предприятия", "Аудит", null, null, QueryIntent.COMMERCIAL),
                new Seed("Подготовка к экологической проверке", "Проверки", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Разрешение на эмиссии в окружающую среду", "Разрешения", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Плата за эмиссии - как рассчитать", "Разрешения", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Утилизация отходов производства - лицензия", "Отходы", null, null, QueryIntent.COMMERCIAL),
                new Seed("Паспорт отхода - как оформить", "Отходы", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Инвентаризация источников выбросов", "НДВ", null, null, QueryIntent.INFORMATIONAL),
                new Seed("Экологическая экспертиза проекта - сроки", "Экспертиза", null, null, QueryIntent.INFORMATIONAL)
        );

        for (Seed s : seeds) {
            GeoMonitoredQuery q = new GeoMonitoredQuery();
            q.setQuery(s.query());
            q.setCategory(s.category());
            q.setServiceId(s.serviceId());
            q.setCitySlug(s.citySlug());
            q.setIntent(s.intent());
            repository.save(q);
        }
    }
}
