package kz.eco.services.dto;

import kz.eco.content.dto.FaqItemDto;
import kz.eco.services.EcoService;

import java.util.List;

/** AEO (Answer-Engine-Optimization) structured blocks - kept as one nested object so the frontend
 *  can render each block as real visible HTML on the page (module fix item 1: "ответы видимы в
 *  обычном HTML, а не только JSON-LD"), while EcoServiceSeoService independently turns the same
 *  data into FAQPage/HowTo JSON-LD for answer engines. */
public record EcoServiceAeoDto(
        String shortAnswer,
        String whoNeeds,
        String whenRequired,
        String whenNotRequired,
        List<String> requiredDocuments,
        List<String> customerReceives,
        String timeline,
        List<String> pricingFactors,
        List<String> legalBasis,
        List<String> commonMistakes,
        List<FaqItemDto> faq
) {
    public static EcoServiceAeoDto from(EcoService e) {
        return new EcoServiceAeoDto(
                e.getShortAnswer(),
                e.getWhoNeeds(),
                e.getWhenRequired(),
                e.getWhenNotRequired(),
                List.copyOf(e.getRequiredDocuments()),
                List.copyOf(e.getCustomerReceives()),
                e.getTimeline(),
                List.copyOf(e.getPricingFactors()),
                List.copyOf(e.getLegalBasis()),
                List.copyOf(e.getCommonMistakes()),
                e.getFaq().stream().map(FaqItemDto::from).toList()
        );
    }
}
