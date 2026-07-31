package kz.eco.tariff.dto;

import kz.eco.tariff.Tariff;

import java.util.List;

public record TariffResponse(
        String id,
        String name,
        String price,
        String description,
        List<String> features,
        String cta,
        String mode,
        boolean popular
) {
    public static TariffResponse from(Tariff t) {
        return new TariffResponse(
                t.getId(), t.getName(), t.getPrice(), t.getDescription(),
                List.copyOf(t.getFeatures()), t.getCta(), t.getMode().getLabel(), t.isPopular()
        );
    }
}
