package kz.eco.pek;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.deser.DeserializationProblemHandler;

/**
 * Makes a silently-dropped request field visible in the log instead of invisible.
 *
 * <p>Jackson ignores unknown JSON properties by default, so a program-creation request could carry
 * {@code actualCapacity} / {@code monitoringScope} / {@code readinessNotes}, get a 200 back, and
 * have those values never reach the database - which is exactly how the reported data loss stayed
 * unnoticed. The fields themselves are fixed (V114); this guard is about the next one.
 *
 * <p>Deliberately logs rather than rejects: turning unknown properties into a 400 would be a
 * breaking API change for any client that sends an extra field today, and the point here is to
 * surface the loss, not to start refusing requests. Scoped to the PEK program request DTOs so it
 * cannot add noise for the rest of the application.
 */
@Configuration
public class PekUnknownFieldReporter {

    private static final Logger log = LoggerFactory.getLogger(PekUnknownFieldReporter.class);

    @Bean
    JsonMapperBuilderCustomizer pekUnknownProgramFieldLogging() {
        return builder -> builder.addHandler(new DeserializationProblemHandler() {
            @Override
            public boolean handleUnknownProperty(DeserializationContext context, JsonParser parser,
                                                 ValueDeserializer<?> deserializer, Object beanOrClass,
                                                 String propertyName) {
                if (isPekProgramRequest(beanOrClass)) {
                    log.warn("[PEK] Поле '{}' пришло в запросе {}, но отсутствует в DTO - значение НЕ сохранено. "
                                    + "Добавьте поле в DTO/сущность/миграцию либо уберите его из запроса.",
                            propertyName, targetName(beanOrClass));
                }
                // false = keep Jackson's default behaviour (skip the value); never change the
                // response, only report.
                return false;
            }
        });
    }

    private static boolean isPekProgramRequest(Object beanOrClass) {
        String name = targetName(beanOrClass);
        return name.startsWith("kz.eco.pek.dto.PekApiDtos$")
                && (name.endsWith("CreateProgramRequest")
                    || name.endsWith("EditProgramRequest")
                    || name.endsWith("FacilitySnapshotDto"));
    }

    private static String targetName(Object beanOrClass) {
        if (beanOrClass == null) {
            return "";
        }
        Class<?> type = beanOrClass instanceof Class<?> c ? c : beanOrClass.getClass();
        return type.getName();
    }
}
