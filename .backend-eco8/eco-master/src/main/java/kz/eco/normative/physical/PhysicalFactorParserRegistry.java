package kz.eco.normative.physical;

import kz.eco.normative.NormativeRecord;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class PhysicalFactorParserRegistry {

    private final List<PhysicalFactorTableParser> parsers;

    public PhysicalFactorParserRegistry(List<PhysicalFactorTableParser> parsers) {
        this.parsers = parsers;
    }

    public Optional<PhysicalFactorTableParser> find(String parserType) {
        if (parserType == null || parserType.isBlank()) {
            return findGeneric();
        }
        return parsers.stream()
                .filter(parser -> parser.supports(parserType))
                .findFirst()
                .or(this::findGeneric);
    }

    public Optional<PhysicalFactorTableParser> findGeneric() {
        return parsers.stream()
                .filter(parser -> parser.supports(GenericPhysicalFactorTableParser.PARSER_TYPE))
                .findFirst();
    }
}
