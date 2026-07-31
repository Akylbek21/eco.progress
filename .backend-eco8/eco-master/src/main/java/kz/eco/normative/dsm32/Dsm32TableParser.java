package kz.eco.normative.dsm32;

import kz.eco.normative.NormativeRecord;

import java.util.List;

public interface Dsm32TableParser {

    boolean supports(String parserType);

    List<NormativeRecord> parse(Dsm32ImportContext context, List<List<String>> rows);
}
