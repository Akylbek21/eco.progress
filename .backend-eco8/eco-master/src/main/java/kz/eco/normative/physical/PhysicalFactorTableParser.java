package kz.eco.normative.physical;

import kz.eco.normative.NormativeRecord;

import java.util.List;

public interface PhysicalFactorTableParser {

    boolean supports(String parserType);

    List<NormativeRecord> parse(PhysicalFactorImportContext context, List<List<String>> rows);
}
