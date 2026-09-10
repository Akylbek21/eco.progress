package kz.eco.protocol;

import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class ProtocolNumberGenerator {

    private final ProtocolNumberCounterService counterService;

    public ProtocolNumberGenerator(ProtocolNumberCounterService counterService) {
        this.counterService = counterService;
    }

    /** Delegates the actual sequence reservation to ProtocolNumberCounterService, which takes a
     *  pessimistic row lock on a dedicated counter row in its own short transaction - see that
     *  class for why the previous MAX(protocol_number)-in-the-same-transaction approach caused
     *  duplicate-key 409s under concurrent/double-click quick-create calls. */
    public String generate(ProtocolTemplate template, LocalDate protocolDate) {
        ProtocolTemplateCode code = ProtocolTemplateCode.fromCode(template.getCode());
        String prefix = code.numberPrefix();
        int year = protocolDate.getYear();
        long next = counterService.nextValue(prefix, year);
        return prefix + "-" + year + "-" + String.format("%04d", next);
    }
}
