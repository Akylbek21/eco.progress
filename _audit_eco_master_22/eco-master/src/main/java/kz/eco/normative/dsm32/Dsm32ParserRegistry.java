package kz.eco.normative.dsm32;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class Dsm32ParserRegistry {

    private final List<Dsm32TableParser> parsers;

    public Dsm32ParserRegistry(List<Dsm32TableParser> parsers) {
        this.parsers = parsers;
    }

    public Optional<Dsm32TableParser> find(String parserType) {
        if (parserType == null || parserType.isBlank()) {
            return Optional.empty();
        }
        return parsers.stream()
                .filter(parser -> parser.supports(parserType))
                .findFirst();
    }
}
