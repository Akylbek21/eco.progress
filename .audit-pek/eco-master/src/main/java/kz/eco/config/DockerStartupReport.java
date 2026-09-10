package kz.eco.config;

import kz.eco.storage.MongoConnectionFailures;
import org.bson.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Component;

@Component
public class DockerStartupReport {

    public static final String MARKER = "[ECO-STARTUP]";

    private static final Logger log = LoggerFactory.getLogger(DockerStartupReport.class);

    private final Environment environment;
    private final MongoTemplate mongoTemplate;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.datasource.username:}")
    private String datasourceUser;

    @Value("${spring.mongodb.uri:}")
    private String mongoUri;

    @Value("${eco.storage.backend:auto}")
    private String storageBackend;

    @Value("${eco.storage.directory:/app/uploads}")
    private String storageDirectory;

    public DockerStartupReport(Environment environment,
                               @Autowired(required = false) MongoTemplate mongoTemplate) {
        this.environment = environment;
        this.mongoTemplate = mongoTemplate;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        String[] profiles = environment.getActiveProfiles();
        log.warn("{} profiles={}", MARKER, profiles.length > 0 ? String.join(",", profiles) : "(default)");
        log.warn("{} mysql={} user={}", MARKER, maskJdbcPassword(datasourceUrl), datasourceUser);
        log.warn("{} mongodb={}", MARKER, maskMongoPassword(mongoUri));
        log.warn("{} storage backend={} directory={}", MARKER, storageBackend, storageDirectory);

        if (mongoUri != null && mongoUri.contains("localhost:27017")) {
            log.warn("{} mongodb указывает на localhost — в Docker нужен хост mongo в application-docker.properties", MARKER);
        }

        if (mongoTemplate == null) {
            log.warn("{} mongodb ping=SKIP (MongoTemplate отсутствует)", MARKER);
            return;
        }

        try {
            Document ping = mongoTemplate.getDb().runCommand(new Document("ping", 1));
            log.warn("{} mongodb ping=OK ok={}", MARKER, ping.get("ok"));
        } catch (Exception ex) {
            log.warn("{} mongodb ping=FAILED error={}", MARKER, ex.getMessage());
            if (MongoConnectionFailures.isConnectionFailure(ex)) {
                log.warn("{} при storage.backend=auto файлы сохраняются на диск; для GridFS: docker compose restart app mongo", MARKER);
            }
        }
    }

    private static String maskJdbcPassword(String url) {
        if (url == null || url.isBlank()) {
            return "(not set)";
        }
        return url;
    }

    private static String maskMongoPassword(String uri) {
        if (uri == null || uri.isBlank()) {
            return "(not set)";
        }
        return uri.replaceAll("://([^:]+):([^@]+)@", "://$1:***@");
    }
}
